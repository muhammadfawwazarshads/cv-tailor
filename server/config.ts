import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";
const dataDir = path.resolve(process.env.DATA_DIR || "data");
fs.mkdirSync(dataDir, { recursive: true });

function loadSecret(): string {
  if (process.env.APP_SECRET) {
    if (process.env.APP_SECRET.length < 32) throw new Error("APP_SECRET must be at least 32 characters.");
    return process.env.APP_SECRET;
  }
  if (isProd) throw new Error("APP_SECRET is required in production (used to sign sessions and encrypt API keys).");
  // Development: generate once and keep it next to the local database.
  const file = path.join(dataDir, ".dev-secret");
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString("hex"), { mode: 0o600 });
  return fs.readFileSync(file, "utf8").trim();
}

function allowedOrigins(): string[] {
  const list = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  // GitHub Codespaces exposes forwarded ports on https://<codespace>-<port>.<domain>
  const cs = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (cs && domain) list.push(`https://${cs}-${process.env.PORT || 3000}.${domain}`, `https://${cs}-5173.${domain}`);
  return list.map((o) => o.replace(/\/+$/, ""));
}

const int = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const config = {
  isProd,
  port: int(process.env.PORT, 3000),
  dataDir,
  databaseUrl: process.env.DATABASE_URL || "",
  secret: loadSecret(),
  allowRegistration: process.env.ALLOW_REGISTRATION !== "false",
  enableMockLlm: process.env.ENABLE_MOCK_LLM === "true",
  llmTimeoutMs: int(process.env.LLM_TIMEOUT_MS, 120_000),
  /** Successful AI calls allowed per user per day (0 = unlimited). Admins are not limited. */
  dailyAiLimit: int(process.env.DAILY_AI_LIMIT, 50),
  maxUploadMb: int(process.env.MAX_UPLOAD_MB, 10),
  /** Extra origins allowed to call the API (comma separated), e.g. a public URL behind a proxy. */
  allowedOrigins: allowedOrigins(),
};
