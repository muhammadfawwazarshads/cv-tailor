import cookieParser from "cookie-parser";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { authRouter, loadUser, usersRouter } from "./auth.js";
import { config } from "./config.js";
import { initDb } from "./db/index.js";
import { errorHandler } from "./http.js";
import { adminRouter } from "./routes/admin.js";
import { applicationsRouter } from "./routes/applications.js";
import { formsRouter } from "./routes/forms.js";
import { leadsRouter } from "./routes/leads.js";
import { personalRouter } from "./routes/personal.js";
import { factsRouter, profileRouter } from "./routes/profile.js";

await initDb();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "same-origin");
  res.setHeader("x-frame-options", "DENY");
  next();
});

// Basic CSRF defence for cookie auth: state-changing API calls must come from our own origin.
app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  // Browsers mark requests from the page itself; this survives proxies that rewrite the Host header (Codespaces, Render).
  if (req.get("sec-fetch-site") === "same-origin") return next();
  if (origin) {
    const host = new URL(origin).host;
    const sameHost = host === req.get("host") || host === req.get("x-forwarded-host");
    if (!sameHost && !config.allowedOrigins.includes(origin)) return res.status(403).json({ error: "Origin tidak diizinkan." });
  }
  next();
});

app.use(loadUser);
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/facts", factsRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/personal", personalRouter);
app.use("/api/forms", formsRouter);
app.use("/api/admin/users", usersRouter);
app.use("/api/admin", adminRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan." }));

// Serve the built client in production.
const clientDir = path.resolve("dist-client");
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDir, "index.html")));
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}${config.enableMockLlm ? "  (mock LLM enabled)" : ""}`);
});
