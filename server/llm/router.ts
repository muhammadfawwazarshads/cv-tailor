import type { z } from "zod";
import { config } from "../config.js";
import { decrypt } from "../crypto.js";
import { one, query } from "../db/index.js";
import { HttpError } from "../http.js";
import type { ProviderType } from "../shared/schemas.js";
import { callProvider, LlmError, type LlmRequest, type ProviderConfig } from "./providers.js";

type Caller = { id: string; role: "admin" | "user" } | null;

export type ProviderRow = {
  id: string;
  name: string;
  type: ProviderType;
  model: string;
  base_url: string;
  api_version: string;
  api_key_enc: string;
  priority: number;
  enabled: boolean;
};

export function toConfig(row: ProviderRow): ProviderConfig {
  let apiKey = "";
  try {
    apiKey = decrypt(row.api_key_enc);
  } catch {
    apiKey = "";
  }
  return { id: row.id, name: row.name, type: row.type, model: row.model, baseUrl: row.base_url, apiVersion: row.api_version, apiKey };
}

async function activeProviders(): Promise<ProviderConfig[]> {
  const rows = await query<ProviderRow>(`SELECT * FROM llm_providers WHERE enabled = true ORDER BY priority ASC, created_at ASC`);
  return rows.filter((r) => r.type !== "mock" || config.enableMockLlm).map(toConfig);
}

async function logUsage(entry: {
  userId?: string | null;
  provider: ProviderConfig;
  task: string;
  status: "success" | "error" | "invalid_output";
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}) {
  try {
    await query(
      `INSERT INTO ai_usage (user_id, provider_id, provider_name, model, task, status, latency_ms, input_tokens, output_tokens, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.userId ?? null,
        entry.provider.id,
        entry.provider.name,
        entry.provider.model,
        entry.task,
        entry.status,
        entry.latencyMs,
        entry.inputTokens ?? 0,
        entry.outputTokens ?? 0,
        entry.error?.slice(0, 1000) ?? null,
      ],
    );
  } catch (e) {
    console.error("[llm] failed to log usage", e);
  }
}

async function enforceDailyLimit(caller: Caller) {
  if (!caller || caller.role === "admin" || config.dailyAiLimit <= 0) return;
  const row = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM ai_usage WHERE user_id = $1 AND status = 'success' AND created_at > now() - interval '1 day'`,
    [caller.id],
  );
  if ((row?.n ?? 0) >= config.dailyAiLimit) {
    throw new HttpError(429, `Batas pemakaian AI harian (${config.dailyAiLimit} permintaan) sudah tercapai. Coba lagi besok.`);
  }
}

/** Pulls the first JSON object out of a model response (handles code fences and leading text). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Tidak ada objek JSON di respons");
  return JSON.parse(candidate.slice(start, end + 1));
}

export type JsonCallResult<T> = { data: T; provider: string; model: string; attempts: string[] };

/**
 * Calls enabled providers in priority order. A provider that errors (network, timeout, rate limit,
 * 5xx, auth) or returns output that fails validation twice is skipped and the next one is tried.
 */
export async function callJson<S extends z.ZodTypeAny>(
  caller: Caller,
  req: LlmRequest,
  schema: S,
  opts: { providers?: ProviderConfig[] } = {},
): Promise<JsonCallResult<z.infer<S>>> {
  const providers = opts.providers ?? (await activeProviders());
  if (!providers.length) {
    throw new HttpError(503, "Belum ada provider AI yang aktif. Minta admin menambahkan provider di menu Provider AI.");
  }
  await enforceDailyLimit(caller);

  const attempts: string[] = [];
  for (const provider of providers) {
    let current = req;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const out = await callProvider(provider, current, config.llmTimeoutMs);
        const latencyMs = Date.now() - started;
        let parsed: unknown;
        try {
          parsed = extractJson(out.text);
        } catch (e: any) {
          throw Object.assign(new Error(`JSON tidak valid: ${e.message}`), { invalid: true, out, latencyMs });
        }
        const result = schema.safeParse(parsed);
        if (!result.success) {
          const issues = result.error.issues
            .slice(0, 6)
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ");
          throw Object.assign(new Error(`Struktur JSON tidak sesuai: ${issues}`), { invalid: true, out, latencyMs });
        }
        await logUsage({
          userId: caller?.id,
          provider,
          task: req.task,
          status: "success",
          latencyMs,
          inputTokens: out.inputTokens,
          outputTokens: out.outputTokens,
        });
        attempts.push(`${provider.name}: ok`);
        return { data: result.data, provider: provider.name, model: provider.model, attempts };
      } catch (e: any) {
        const latencyMs = e?.latencyMs ?? Date.now() - started;
        const invalid = Boolean(e?.invalid);
        await logUsage({
          userId: caller?.id,
          provider,
          task: req.task,
          status: invalid ? "invalid_output" : "error",
          latencyMs,
          inputTokens: e?.out?.inputTokens,
          outputTokens: e?.out?.outputTokens,
          error: e?.message,
        });
        attempts.push(`${provider.name}: ${e?.message ?? "error"}`);
        console.warn(`[llm] ${provider.name} (${provider.type}/${provider.model}) failed on ${req.task}: ${e?.message}`);
        if (invalid && attempt === 1) {
          // One repair attempt on the same provider before falling back.
          current = {
            ...req,
            user: `${req.user}\n\nIMPORTANT: Your previous answer could not be used (${e.message}). Reply again with ONLY one valid JSON object that matches the required shape exactly.`,
          };
          continue;
        }
        break; // move on to the next provider
      }
    }
  }
  const detail = attempts.map((a) => `• ${a}`).join("\n");
  throw new HttpError(502, `Semua provider AI gagal.\n${detail}`);
}

/** Lightweight connectivity check used by the admin "Test" button. */
export async function testProvider(provider: ProviderConfig) {
  const started = Date.now();
  const out = await callProvider(
    provider,
    {
      task: "test",
      system: "You are a health check. Reply with JSON only.",
      user: 'Reply with exactly this JSON: {"ok": true}',
      maxTokens: 50,
    },
    Math.min(config.llmTimeoutMs, 30_000),
  );
  return { latencyMs: Date.now() - started, sample: out.text.slice(0, 200), inputTokens: out.inputTokens, outputTokens: out.outputTokens };
}

export { LlmError };
