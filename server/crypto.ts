import crypto from "node:crypto";
import { config } from "./config.js";

// API keys are stored encrypted with AES-256-GCM, keyed from APP_SECRET.
const key = crypto.createHash("sha256").update(`llm-keys:${config.secret}`).digest();

export function encrypt(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(value: string): string {
  if (!value) return "";
  const [v, iv, tag, data] = value.split(":");
  if (v !== "v1") throw new Error("Unknown key format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function maskKey(plain: string): string {
  if (!plain) return "";
  return plain.length <= 8 ? "••••" : `${plain.slice(0, 4)}••••${plain.slice(-4)}`;
}
