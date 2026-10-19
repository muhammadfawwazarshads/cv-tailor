import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { extractProfile } from "../ai/service.js";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";
import { one, query } from "../db/index.js";
import { HttpError, wrap } from "../http.js";
import { emptyProfile, ProfileSchema, type Profile } from "../shared/schemas.js";

export async function getProfile(userId: string): Promise<Profile> {
  const row = await one<{ data: unknown }>(`SELECT data FROM profiles WHERE user_id = $1`, [userId]);
  return row ? ProfileSchema.parse(row.data) : emptyProfile();
}

export async function getFacts(userId: string): Promise<string[]> {
  return (await query<{ text: string }>(`SELECT text FROM facts WHERE user_id = $1 ORDER BY created_at`, [userId])).map((r) => r.text);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
});

async function pdfToText(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get(
  "/",
  wrap(async (req) => {
    const row = await one<{ data: unknown; updated_at: string }>(`SELECT data, updated_at FROM profiles WHERE user_id = $1`, [req.user!.id]);
    return { profile: row ? ProfileSchema.parse(row.data) : emptyProfile(), updatedAt: row?.updated_at ?? null };
  }),
);

profileRouter.put(
  "/",
  wrap(async (req) => {
    const profile = ProfileSchema.parse(req.body?.profile);
    profile.experience.forEach((e, i) => (e.id ||= `exp-${Date.now()}-${i}`));
    profile.education.forEach((e, i) => (e.id ||= `edu-${Date.now()}-${i}`));
    profile.projects.forEach((e, i) => (e.id ||= `proj-${Date.now()}-${i}`));
    await query(
      `INSERT INTO profiles (user_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [req.user!.id, JSON.stringify(profile)],
    );
    return { profile };
  }),
);

/** Extracts a structured profile from an uploaded PDF or pasted text. Returns a draft; the client saves it. */
profileRouter.post(
  "/import",
  upload.single("file"),
  wrap(async (req) => {
    let text = typeof req.body?.text === "string" ? req.body.text : "";
    if (req.file) {
      if (req.file.mimetype !== "application/pdf" && !req.file.originalname.toLowerCase().endsWith(".pdf")) {
        throw new HttpError(400, "File harus berformat PDF.");
      }
      try {
        text = await pdfToText(req.file.buffer);
      } catch {
        throw new HttpError(400, "PDF tidak bisa dibaca. Coba tempel isi CV sebagai teks.");
      }
    }
    text = text.trim();
    if (text.length < 50) throw new HttpError(400, "Teks CV terlalu pendek atau PDF tidak berisi teks (mungkin hasil scan).");
    const res = await extractProfile(req.user!, text);
    await query(
      `INSERT INTO profiles (user_id, data, source_text) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET source_text = EXCLUDED.source_text`,
      [req.user!.id, JSON.stringify(emptyProfile()), text],
    );
    return { profile: res.data, provider: res.provider };
  }),
);

/* ---------- Confirmed facts ---------- */

export const factsRouter = Router();
factsRouter.use(requireAuth);

factsRouter.get(
  "/",
  wrap(async (req) => ({
    facts: await query(
      `SELECT f.id, f.text, f.created_at, f.application_id, a.company, a.role_title
         FROM facts f LEFT JOIN applications a ON a.id = f.application_id
        WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
      [req.user!.id],
    ),
  })),
);

factsRouter.post(
  "/",
  wrap(async (req) => {
    const { text } = z.object({ text: z.string().trim().min(3, "Fakta terlalu pendek.").max(2000) }).parse(req.body);
    const fact = await one(`INSERT INTO facts (user_id, text) VALUES ($1, $2) RETURNING id, text, created_at`, [req.user!.id, text]);
    return { fact };
  }),
);

factsRouter.delete(
  "/:id",
  wrap(async (req) => {
    await query(`DELETE FROM facts WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id]);
    return { ok: true };
  }),
);
