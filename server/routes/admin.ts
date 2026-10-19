import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { config } from "../config.js";
import { decrypt, encrypt, maskKey } from "../crypto.js";
import { one, query } from "../db/index.js";
import { HttpError, uuid, wrap } from "../http.js";
import { testProvider, toConfig, type ProviderRow } from "../llm/router.js";
import { ProviderTypes } from "../shared/schemas.js";

function publicProvider(row: ProviderRow) {
  let masked = "";
  try {
    masked = maskKey(decrypt(row.api_key_enc));
  } catch {
    masked = row.api_key_enc ? "(tidak bisa dibuka: APP_SECRET berubah)" : "";
  }
  const { api_key_enc: _, ...rest } = row;
  return { ...rest, api_key_masked: masked, has_key: Boolean(row.api_key_enc) };
}

const ProviderBody = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(100),
  type: z.enum(ProviderTypes),
  model: z.string().trim().max(200).default(""),
  baseUrl: z.string().trim().max(500).default(""),
  apiVersion: z.string().trim().max(50).default(""),
  /** Omit or leave empty to keep the stored key. */
  apiKey: z.string().max(2000).optional(),
  clearKey: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(10_000).default(100),
  enabled: z.boolean().default(true),
});

function validate(body: z.infer<typeof ProviderBody>, hasStoredKey: boolean) {
  if (body.type === "mock" && !config.enableMockLlm) throw new HttpError(400, "Provider mock hanya bisa dipakai jika ENABLE_MOCK_LLM=true.");
  if (body.type !== "mock" && !body.model) throw new HttpError(400, "Model wajib diisi (untuk Azure: nama deployment).");
  if ((body.type === "azure-openai" || body.type === "openai-compatible") && !body.baseUrl) throw new HttpError(400, "Base URL wajib diisi untuk tipe ini.");
  if (body.baseUrl && !/^https?:\/\//i.test(body.baseUrl)) throw new HttpError(400, "Base URL harus diawali http:// atau https://");
  const needsKey = ["anthropic", "openai", "gemini", "azure-openai"].includes(body.type);
  const willHaveKey = (body.apiKey && body.apiKey.trim()) || (hasStoredKey && !body.clearKey);
  if (needsKey && !willHaveKey) throw new HttpError(400, "API key wajib diisi untuk tipe ini.");
}

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get(
  "/providers",
  wrap(async () => {
    const rows = await query<ProviderRow>(`SELECT * FROM llm_providers ORDER BY priority ASC, created_at ASC`);
    const stats = await query(
      `SELECT provider_id,
              count(*)::int AS calls,
              count(*) FILTER (WHERE status = 'success')::int AS ok,
              round(avg(latency_ms) FILTER (WHERE status = 'success'))::int AS avg_latency_ms,
              max(created_at) AS last_used
         FROM ai_usage WHERE created_at > now() - interval '7 days' GROUP BY provider_id`,
    );
    return { providers: rows.map(publicProvider), stats, mockEnabled: config.enableMockLlm, types: ProviderTypes };
  }),
);

adminRouter.post(
  "/providers",
  wrap(async (req, res) => {
    const body = ProviderBody.parse(req.body);
    validate(body, false);
    const row = await one<ProviderRow>(
      `INSERT INTO llm_providers (name, type, model, base_url, api_version, api_key_enc, priority, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.name, body.type, body.model, body.baseUrl, body.apiVersion, encrypt(body.apiKey?.trim() ?? ""), body.priority, body.enabled],
    );
    res.status(201);
    return { provider: publicProvider(row!) };
  }),
);

adminRouter.put(
  "/providers/:id",
  wrap(async (req) => {
    const id = uuid(req.params.id);
    const existing = await one<ProviderRow>(`SELECT * FROM llm_providers WHERE id = $1`, [id]);
    if (!existing) throw new HttpError(404, "Provider tidak ditemukan.");
    const body = ProviderBody.parse(req.body);
    validate(body, Boolean(existing.api_key_enc));
    const keyEnc = body.clearKey ? "" : body.apiKey?.trim() ? encrypt(body.apiKey.trim()) : existing.api_key_enc;
    const row = await one<ProviderRow>(
      `UPDATE llm_providers SET name=$1, type=$2, model=$3, base_url=$4, api_version=$5, api_key_enc=$6, priority=$7, enabled=$8, updated_at=now()
        WHERE id=$9 RETURNING *`,
      [body.name, body.type, body.model, body.baseUrl, body.apiVersion, keyEnc, body.priority, body.enabled, id],
    );
    return { provider: publicProvider(row!) };
  }),
);

adminRouter.post(
  "/providers/reorder",
  wrap(async (req) => {
    const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(req.body);
    for (let i = 0; i < ids.length; i++) await query(`UPDATE llm_providers SET priority = $1, updated_at = now() WHERE id = $2`, [(i + 1) * 10, uuid(ids[i])]);
    return { ok: true };
  }),
);

adminRouter.delete(
  "/providers/:id",
  wrap(async (req) => {
    await query(`DELETE FROM llm_providers WHERE id = $1`, [uuid(req.params.id)]);
    return { ok: true };
  }),
);

adminRouter.post(
  "/providers/:id/test",
  wrap(async (req) => {
    const row = await one<ProviderRow>(`SELECT * FROM llm_providers WHERE id = $1`, [uuid(req.params.id)]);
    if (!row) throw new HttpError(404, "Provider tidak ditemukan.");
    try {
      return { ok: true, ...(await testProvider(toConfig(row))) };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }),
);

adminRouter.get(
  "/usage",
  wrap(async (req) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const summary = await query(
      `SELECT provider_name, model,
              count(*)::int AS calls,
              count(*) FILTER (WHERE status = 'success')::int AS ok,
              count(*) FILTER (WHERE status = 'error')::int AS errors,
              count(*) FILTER (WHERE status = 'invalid_output')::int AS invalid,
              coalesce(sum(input_tokens), 0)::int AS input_tokens,
              coalesce(sum(output_tokens), 0)::int AS output_tokens,
              round(avg(latency_ms) FILTER (WHERE status = 'success'))::int AS avg_latency_ms
         FROM ai_usage WHERE created_at > now() - make_interval(days => $1)
        GROUP BY provider_name, model ORDER BY calls DESC`,
      [days],
    );
    const recent = await query(
      `SELECT u.id, u.created_at, u.provider_name, u.model, u.task, u.status, u.latency_ms, u.input_tokens, u.output_tokens, u.error, us.email
         FROM ai_usage u LEFT JOIN users us ON us.id = u.user_id
        ORDER BY u.created_at DESC LIMIT 200`,
    );
    return { days, summary, recent };
  }),
);
