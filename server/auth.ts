import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { config } from "./config.js";
import { one, query } from "./db/index.js";
import { HttpError, wrap } from "./http.js";

export type SessionUser = { id: string; email: string; name: string; role: "admin" | "user" };

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const COOKIE = "cvt_session";
const key = new TextEncoder().encode(config.secret);
const SESSION_DAYS = 14;

async function setSession(res: Response, userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: SESSION_DAYS * 86_400_000,
    path: "/",
  });
}

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { payload } = await jwtVerify(token, key);
      const user = await one<SessionUser>(`SELECT id, email, name, role FROM users WHERE id = $1`, [payload.sub]);
      if (user) req.user = user;
    } catch {
      /* invalid or expired session: treat as signed out */
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Silakan masuk terlebih dahulu."));
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Silakan masuk terlebih dahulu."));
  if (req.user.role !== "admin") return next(new HttpError(403, "Hanya admin yang bisa mengakses ini."));
  next();
}

/* Very small in-memory brute-force guard for login. */
const attempts = new Map<string, { count: number; until: number }>();
function checkRate(key: string) {
  const a = attempts.get(key);
  if (a && a.until > Date.now() && a.count >= 8) throw new HttpError(429, "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.");
}
function noteFailure(key: string) {
  const a = attempts.get(key);
  if (!a || a.until < Date.now()) attempts.set(key, { count: 1, until: Date.now() + 10 * 60_000 });
  else a.count++;
}

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  password: z.string().min(8, "Password minimal 8 karakter.").max(200),
  name: z.string().trim().max(200).optional(),
});

export const authRouter = Router();

authRouter.get(
  "/config",
  wrap(async () => {
    const users = await one<{ n: number }>(`SELECT count(*)::int AS n FROM users`);
    return { allowRegistration: config.allowRegistration || users?.n === 0, hasUsers: (users?.n ?? 0) > 0 };
  }),
);

authRouter.post(
  "/register",
  wrap(async (req, res) => {
    const body = Credentials.parse(req.body);
    const count = (await one<{ n: number }>(`SELECT count(*)::int AS n FROM users`))?.n ?? 0;
    if (!config.allowRegistration && count > 0) throw new HttpError(403, "Pendaftaran ditutup. Hubungi admin.");
    if (await one(`SELECT 1 FROM users WHERE email = $1`, [body.email])) throw new HttpError(409, "Email sudah terdaftar.");
    const hash = await bcrypt.hash(body.password, 11);
    // The very first account becomes the admin who manages LLM providers.
    const role = count === 0 ? "admin" : "user";
    const user = await one<SessionUser>(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role`,
      [body.email, body.name || body.email.split("@")[0], hash, role],
    );
    await setSession(res, user!.id);
    return { user };
  }),
);

authRouter.post(
  "/login",
  wrap(async (req, res) => {
    const body = Credentials.pick({ email: true }).extend({ password: z.string().min(1).max(200) }).parse(req.body);
    const rateKey = `${req.ip}|${body.email}`;
    checkRate(rateKey);
    const row = await one<SessionUser & { password_hash: string }>(
      `SELECT id, email, name, role, password_hash FROM users WHERE email = $1`,
      [body.email],
    );
    if (!row || !(await bcrypt.compare(body.password, row.password_hash))) {
      noteFailure(rateKey);
      throw new HttpError(401, "Email atau password salah.");
    }
    attempts.delete(rateKey);
    await setSession(res, row.id);
    const { password_hash: _, ...user } = row;
    return { user };
  }),
);

authRouter.post(
  "/logout",
  wrap(async (_req, res) => {
    res.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  }),
);

authRouter.get(
  "/me",
  wrap(async (req) => ({ user: req.user ?? null })),
);

/* ---------- Admin: user management ---------- */

export const usersRouter = Router();
usersRouter.use(requireAdmin);

usersRouter.get(
  "/",
  wrap(async () => ({
    users: await query(
      `SELECT u.id, u.email, u.name, u.role, u.created_at,
              (SELECT count(*)::int FROM applications a WHERE a.user_id = u.id) AS applications
         FROM users u ORDER BY u.created_at`,
    ),
  })),
);

// Admins can add accounts themselves (e.g. when public sign-up is closed); the person signs in with the
// password the admin set and can be told to change it.
usersRouter.post(
  "/",
  wrap(async (req, res) => {
    const body = Credentials.extend({ role: z.enum(["admin", "user"]).default("user") }).parse(req.body);
    if (await one(`SELECT 1 FROM users WHERE email = $1`, [body.email])) throw new HttpError(409, "Email sudah terdaftar.");
    const hash = await bcrypt.hash(body.password, 11);
    const user = await one(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at`,
      [body.email, body.name || body.email.split("@")[0], hash, body.role],
    );
    res.status(201);
    return { user };
  }),
);

usersRouter.patch(
  "/:id",
  wrap(async (req) => {
    const { role } = z.object({ role: z.enum(["admin", "user"]) }).parse(req.body);
    if (req.params.id === req.user!.id && role !== "admin") throw new HttpError(400, "Anda tidak bisa mencabut akses admin Anda sendiri.");
    const user = await one(`UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role`, [role, req.params.id]);
    if (!user) throw new HttpError(404, "Pengguna tidak ditemukan.");
    return { user };
  }),
);
