/**
 * In-browser stand-in for the Express API, used by the single-file build.
 * Same endpoints and response shapes as the server; data lives in localStorage
 * and AI providers are called directly from the browser.
 */
import type { z } from "zod";
import { analyzePrompt, extractProfilePrompt, revisePrompt, tailorPrompt } from "../../../server/ai/prompts";
import { callProvider, type LlmRequest, type ProviderConfig } from "../../../server/llm/providers";
import {
  AnalysisSchema,
  ApplicationStatuses,
  CvDocumentSchema,
  emptyProfile,
  ProfileSchema,
  ProviderTypes,
  TailorResultSchema,
  type Analysis,
  type Answer,
  type CvDocument,
  type Profile,
  type TailorResult,
} from "../../../server/shared/schemas";

const KEY = "cv-tailor:data:v1";
const TIMEOUT = 120_000;

type AppRec = {
  id: string;
  company: string;
  role_title: string;
  job_description: string;
  cv_language: string;
  status: string;
  analysis: Analysis | null;
  answers: Answer[];
  error: string | null;
  created_at: string;
  updated_at: string;
};
type VersionRec = { id: string; application_id: string; number: number; label: string; data: CvDocument; notes: Partial<TailorResult>; created_at: string };
type FactRec = { id: string; text: string; application_id: string | null; created_at: string };
type ProviderRec = { id: string; name: string; type: string; model: string; base_url: string; api_version: string; api_key: string; priority: number; enabled: boolean; created_at: string };
type UsageRec = {
  id: string;
  created_at: string;
  provider_id: string;
  provider_name: string;
  model: string;
  task: string;
  status: "success" | "error" | "invalid_output";
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  error: string | null;
};
type Store = {
  profile: Profile | null;
  profileUpdatedAt: string | null;
  facts: FactRec[];
  applications: AppRec[];
  versions: VersionRec[];
  providers: ProviderRec[];
  usage: UsageRec[];
};

export class LocalError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const now = () => new Date().toISOString();
const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function blank(): Store {
  return { profile: null, profileUpdatedAt: null, facts: [], applications: [], versions: [], providers: [], usage: [] };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch {
    return blank();
  }
}

function save(s: Store) {
  s.usage = s.usage.slice(-500);
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new LocalError(507, "Penyimpanan browser penuh atau diblokir. Ekspor data lalu hapus lamaran lama.");
  }
}

export function exportData(): string {
  const s = load();
  // API keys stay in this browser; they are not part of a backup file.
  return JSON.stringify({ ...s, providers: s.providers.map((p) => ({ ...p, api_key: "" })) }, null, 2);
}

export function importData(json: string) {
  const parsed = JSON.parse(json);
  if (!parsed || !Array.isArray(parsed.applications)) throw new Error("File bukan cadangan CV Tailor.");
  const current = load();
  const keys = new Map(current.providers.map((p) => [p.id, p.api_key]));
  parsed.providers = (parsed.providers ?? []).map((p: ProviderRec) => ({ ...p, api_key: p.api_key || keys.get(p.id) || "" }));
  save({ ...blank(), ...parsed });
}

const mask = (k: string) => (!k ? "" : k.length <= 8 ? "••••" : `${k.slice(0, 4)}••••${k.slice(-4)}`);

function publicProvider(p: ProviderRec) {
  const { api_key, ...rest } = p;
  return { ...rest, api_key_masked: mask(api_key), has_key: Boolean(api_key) };
}

function toConfig(p: ProviderRec): ProviderConfig {
  return { id: p.id, name: p.name, type: p.type as ProviderConfig["type"], model: p.model, baseUrl: p.base_url, apiVersion: p.api_version, apiKey: p.api_key };
}

/* ---------------- AI calls with fallback ---------------- */

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Tidak ada objek JSON di respons");
  return JSON.parse(candidate.slice(start, end + 1));
}

function hint(p: ProviderRec, message: string) {
  if (/Failed to fetch|NetworkError|Load failed|Gagal terhubung/i.test(message)) {
    return `${message}. Browser tidak bisa menghubungi ${p.name}. Biasanya karena koneksi, alamat salah, atau provider ini tidak mengizinkan panggilan langsung dari browser (CORS).`;
  }
  return message;
}

async function callJson<S extends z.ZodTypeAny>(req: LlmRequest, schema: S): Promise<{ data: z.infer<S>; provider: string }> {
  const store = load();
  const providers = store.providers.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at));
  if (!providers.length) throw new LocalError(503, "Belum ada provider AI yang aktif. Tambahkan dulu di menu Provider AI.");
  const attempts: string[] = [];
  const log = (u: Omit<UsageRec, "id" | "created_at">) => {
    const s = load();
    s.usage.push({ id: id(), created_at: now(), ...u });
    save(s);
  };
  for (const p of providers) {
    let current = req;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = performance.now();
      try {
        const out = await callProvider(toConfig(p), current, TIMEOUT);
        const latency = Math.round(performance.now() - started);
        let parsed: unknown;
        try {
          parsed = extractJson(out.text);
        } catch (e: any) {
          throw Object.assign(new Error(`JSON tidak valid: ${e.message}`), { invalid: true, out, latency });
        }
        const r = schema.safeParse(parsed);
        if (!r.success) {
          const issues = r.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
          throw Object.assign(new Error(`Struktur JSON tidak sesuai: ${issues}`), { invalid: true, out, latency });
        }
        log({ provider_id: p.id, provider_name: p.name, model: p.model, task: req.task, status: "success", latency_ms: latency, input_tokens: out.inputTokens, output_tokens: out.outputTokens, error: null });
        return { data: r.data, provider: p.name };
      } catch (e: any) {
        const invalid = Boolean(e?.invalid);
        const msg = hint(p, e?.message ?? String(e));
        log({
          provider_id: p.id,
          provider_name: p.name,
          model: p.model,
          task: req.task,
          status: invalid ? "invalid_output" : "error",
          latency_ms: e?.latency ?? Math.round(performance.now() - started),
          input_tokens: e?.out?.inputTokens ?? 0,
          output_tokens: e?.out?.outputTokens ?? 0,
          error: msg.slice(0, 1000),
        });
        attempts.push(`${p.name}: ${msg}`);
        if (invalid && attempt === 1) {
          current = { ...req, user: `${req.user}\n\nIMPORTANT: Your previous answer could not be used (${e.message}). Reply again with ONLY one valid JSON object that matches the required shape exactly.` };
          continue;
        }
        break;
      }
    }
  }
  throw new LocalError(502, `Semua provider AI gagal.\n${attempts.map((a) => `• ${a}`).join("\n")}`);
}

const answersText = (answers: Answer[]) =>
  answers
    .filter((a) => a.answer.trim())
    .map((a) => `Q: ${a.question}\nA: ${a.answer.trim()}`)
    .join("\n\n");
const compact = (v: unknown) => JSON.stringify(v, (_k, x) => (x === "" || (Array.isArray(x) && x.length === 0) ? undefined : x));

function jobCtx(s: Store, app: AppRec) {
  const profile = s.profile ? ProfileSchema.parse(s.profile) : emptyProfile();
  if (!profile.name && !profile.experience.length && !profile.summary) {
    throw new LocalError(400, "Profil CV kamu masih kosong. Isi atau impor CV di menu Profil dulu.");
  }
  return { profile, facts: s.facts.map((f) => f.text), jobDescription: app.job_description, company: app.company, role: app.role_title };
}

async function runAnalysis(appId: string) {
  let s = load();
  const app = s.applications.find((a) => a.id === appId)!;
  try {
    const ctx = jobCtx(s, app);
    const p = analyzePrompt({ ...ctx, profileJson: compact(ctx.profile), answers: answersText(app.answers) });
    const res = await callJson({ task: "analyze", ...p, maxTokens: 6_000, meta: { ...ctx, answers: app.answers } }, AnalysisSchema);
    s = load();
    const a = s.applications.find((x) => x.id === appId)!;
    a.analysis = res.data;
    a.error = null;
    if (a.status === "analyzing") a.status = "questions";
    a.updated_at = now();
    save(s);
    return a;
  } catch (e: any) {
    s = load();
    const a = s.applications.find((x) => x.id === appId)!;
    a.error = String(e?.message ?? e).slice(0, 2000);
    a.updated_at = now();
    save(s);
    throw e;
  }
}

function addVersion(appId: string, label: string, r: TailorResult) {
  const s = load();
  const number = Math.max(0, ...s.versions.filter((v) => v.application_id === appId).map((v) => v.number)) + 1;
  const v: VersionRec = {
    id: id(),
    application_id: appId,
    number,
    label: label.slice(0, 200),
    data: r.cv,
    notes: { changes: r.changes, notClaimed: r.notClaimed, interviewPrep: r.interviewPrep },
    created_at: now(),
  };
  s.versions.push(v);
  const a = s.applications.find((x) => x.id === appId)!;
  if (a.status === "analyzing" || a.status === "questions") a.status = "tailored";
  a.updated_at = now();
  save(s);
  return v;
}

/* ---------------- Router ---------------- */

const LOCAL_USER = { id: "local", email: "browser ini", name: "Kamu", role: "admin" as const };

function findApp(s: Store, appId: string) {
  const a = s.applications.find((x) => x.id === appId);
  if (!a) throw new LocalError(404, "Lamaran tidak ditemukan.");
  return a;
}
function findVersion(s: Store, appId: string, vid: string) {
  const v = s.versions.find((x) => x.id === vid && x.application_id === appId);
  if (!v) throw new LocalError(404, "Versi CV tidak ditemukan.");
  return v;
}

async function pdfToText(file: File) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export async function localApi(method: string, rawUrl: string, body?: any): Promise<any> {
  const url = new URL(rawUrl, "http://local");
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const route = `${method} /${parts.join("/")}`;
  const m = (pattern: RegExp) => route.match(pattern);
  let s = load();
  let r: RegExpMatchArray | null;

  /* auth */
  if (route === "GET /auth/me") return { user: { ...LOCAL_USER, name: s.profile?.name?.split(" ")[0] || "Kamu" } };
  if (route === "GET /auth/config") return { allowRegistration: false, hasUsers: true };
  if (route === "POST /auth/logout") return { ok: true };

  /* profile */
  if (route === "GET /profile") return { profile: s.profile ? ProfileSchema.parse(s.profile) : emptyProfile(), updatedAt: s.profileUpdatedAt };
  if (route === "PUT /profile") {
    const profile = ProfileSchema.parse(body?.profile);
    profile.experience.forEach((e, i) => (e.id ||= `exp-${Date.now()}-${i}`));
    profile.education.forEach((e, i) => (e.id ||= `edu-${Date.now()}-${i}`));
    profile.projects.forEach((e, i) => (e.id ||= `proj-${Date.now()}-${i}`));
    s.profile = profile;
    s.profileUpdatedAt = now();
    save(s);
    return { profile };
  }
  if (route === "POST /profile/import") {
    let text = "";
    if (body instanceof FormData) {
      const file = body.get("file");
      text = file instanceof File ? await pdfToText(file).catch(() => { throw new LocalError(400, "PDF tidak bisa dibaca. Coba tempel isi CV sebagai teks."); }) : String(body.get("text") ?? "");
    }
    text = text.trim();
    if (text.length < 50) throw new LocalError(400, "Teks CV terlalu pendek atau PDF tidak berisi teks (mungkin hasil scan).");
    text = text.slice(0, 60_000);
    const p = extractProfilePrompt(text);
    const res = await callJson({ task: "extract_profile", ...p, maxTokens: 12_000, meta: { sourceText: text } }, ProfileSchema);
    res.data.experience.forEach((e, i) => (e.id ||= `exp-${i + 1}`));
    res.data.education.forEach((e, i) => (e.id ||= `edu-${i + 1}`));
    res.data.projects.forEach((e, i) => (e.id ||= `proj-${i + 1}`));
    return { profile: res.data, provider: res.provider };
  }

  /* facts */
  if (route === "GET /facts") {
    return {
      facts: [...s.facts].reverse().map((f) => {
        const a = s.applications.find((x) => x.id === f.application_id);
        return { ...f, company: a?.company ?? null, role_title: a?.role_title ?? null };
      }),
    };
  }
  if (route === "POST /facts") {
    const text = String(body?.text ?? "").trim();
    if (text.length < 3) throw new LocalError(400, "Fakta terlalu pendek.");
    const fact = { id: id(), text, application_id: null, created_at: now() };
    s.facts.push(fact);
    save(s);
    return { fact };
  }
  if ((r = m(/^DELETE \/facts\/([^/]+)$/))) {
    s.facts = s.facts.filter((f) => f.id !== r![1]);
    save(s);
    return { ok: true };
  }

  /* applications */
  if (route === "GET /applications") {
    return {
      applications: [...s.applications]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((a) => ({
          id: a.id,
          company: a.company,
          role_title: a.role_title,
          status: a.status,
          cv_language: a.cv_language,
          created_at: a.created_at,
          updated_at: a.updated_at,
          error: a.error,
          fit_score: a.analysis?.fitScore ?? null,
          verdict: a.analysis?.verdict ?? null,
          versions: s.versions.filter((v) => v.application_id === a.id).length,
        })),
    };
  }
  if (route === "POST /applications") {
    const jd = String(body?.jobDescription ?? "").trim();
    if (jd.length < 80) throw new LocalError(400, "Deskripsi pekerjaan terlalu pendek. Tempel JD lengkapnya.");
    const app: AppRec = {
      id: id(),
      company: String(body?.company ?? "").trim(),
      role_title: String(body?.roleTitle ?? "").trim(),
      job_description: jd,
      cv_language: String(body?.cvLanguage ?? "English"),
      status: "analyzing",
      analysis: null,
      answers: [],
      error: null,
      created_at: now(),
      updated_at: now(),
    };
    jobCtx(s, app);
    s.applications.push(app);
    save(s);
    try {
      return { application: await runAnalysis(app.id) };
    } catch (e: any) {
      return { application: { ...findApp(load(), app.id), error: String(e?.message ?? e) } };
    }
  }
  if ((r = m(/^GET \/applications\/([^/]+)$/))) {
    const app = findApp(s, r[1]);
    return { application: app, versions: s.versions.filter((v) => v.application_id === app.id).sort((a, b) => b.number - a.number) };
  }
  if ((r = m(/^PATCH \/applications\/([^/]+)$/))) {
    const app = findApp(s, r[1]);
    if (body?.status && (ApplicationStatuses as readonly string[]).includes(body.status)) app.status = body.status;
    if (typeof body?.company === "string") app.company = body.company.trim();
    if (typeof body?.roleTitle === "string") app.role_title = body.roleTitle.trim();
    if (typeof body?.cvLanguage === "string") app.cv_language = body.cvLanguage;
    app.updated_at = now();
    save(s);
    return { application: app };
  }
  if ((r = m(/^DELETE \/applications\/([^/]+)$/))) {
    s.applications = s.applications.filter((a) => a.id !== r![1]);
    s.versions = s.versions.filter((v) => v.application_id !== r![1]);
    save(s);
    return { ok: true };
  }
  if ((r = m(/^POST \/applications\/([^/]+)\/analyze$/))) {
    findApp(s, r[1]);
    return { application: await runAnalysis(r[1]) };
  }
  if ((r = m(/^POST \/applications\/([^/]+)\/answers$/))) {
    const app = findApp(s, r[1]);
    const merged = new Map(app.answers.map((a) => [a.questionId, a]));
    for (const a of (body?.answers ?? []) as (Answer & { saveAsFact?: boolean })[]) {
      if (a.answer.trim()) merged.set(a.questionId, { questionId: a.questionId, question: a.question, answer: a.answer.trim() });
      else merged.delete(a.questionId);
      if (a.saveAsFact && a.answer.trim()) s.facts.push({ id: id(), text: `${a.answer.trim()} (menjawab: "${a.question}")`, application_id: app.id, created_at: now() });
    }
    app.answers = [...merged.values()];
    app.updated_at = now();
    save(s);
    return { application: app };
  }
  if ((r = m(/^POST \/applications\/([^/]+)\/tailor$/))) {
    const app = findApp(s, r[1]);
    const ctx = jobCtx(s, app);
    const analysis = app.analysis ? AnalysisSchema.parse(app.analysis) : null;
    const p = tailorPrompt({ ...ctx, profileJson: compact(ctx.profile), answers: answersText(app.answers), analysisJson: compact(analysis ?? {}), cvLanguage: app.cv_language });
    const res = await callJson({ task: "tailor", ...p, maxTokens: 16_000, meta: { ...ctx, answers: app.answers, analysis } }, TailorResultSchema);
    return { version: addVersion(app.id, `Disesuaikan AI (${res.provider})`, res.data), provider: res.provider };
  }
  if ((r = m(/^POST \/applications\/([^/]+)\/versions\/([^/]+)\/revise$/))) {
    const app = findApp(s, r[1]);
    const v = findVersion(s, app.id, r[2]);
    const instruction = String(body?.instruction ?? "").trim();
    if (instruction.length < 3) throw new LocalError(400, "Instruksi terlalu pendek.");
    const ctx = jobCtx(s, app);
    const p = revisePrompt({
      ...ctx,
      profileJson: compact(ctx.profile),
      cvJson: JSON.stringify(v.data),
      notesJson: JSON.stringify({ notClaimed: v.notes.notClaimed ?? [], interviewPrep: v.notes.interviewPrep ?? [] }),
      instruction,
      cvLanguage: app.cv_language,
    });
    const res = await callJson({ task: "revise", ...p, maxTokens: 16_000, meta: { cv: v.data, notes: v.notes, instruction } }, TailorResultSchema);
    if (body?.saveAsFact) {
      const s2 = load();
      s2.facts.push({ id: id(), text: instruction, application_id: app.id, created_at: now() });
      save(s2);
    }
    return { version: addVersion(app.id, `Revisi: ${instruction}`, res.data), provider: res.provider };
  }
  if ((r = m(/^PUT \/applications\/([^/]+)\/versions\/([^/]+)$/))) {
    const app = findApp(s, r[1]);
    const v = findVersion(s, app.id, r[2]);
    const cv = CvDocumentSchema.parse(body?.cv);
    return {
      version: addVersion(app.id, `Edit manual dari versi ${v.number}`, { cv, changes: ["Diedit manual."], notClaimed: v.notes.notClaimed ?? [], interviewPrep: v.notes.interviewPrep ?? [] }),
    };
  }

  /* admin: providers and usage */
  if (route === "GET /admin/providers") {
    const since = Date.now() - 7 * 86_400_000;
    const stats = s.providers.map((p) => {
      const rows = s.usage.filter((u) => u.provider_id === p.id && Date.parse(u.created_at) > since);
      const ok = rows.filter((u) => u.status === "success");
      return {
        provider_id: p.id,
        calls: rows.length,
        ok: ok.length,
        avg_latency_ms: ok.length ? Math.round(ok.reduce((n, u) => n + u.latency_ms, 0) / ok.length) : null,
        last_used: rows.at(-1)?.created_at ?? null,
      };
    }).filter((x) => x.calls > 0);
    return {
      providers: [...s.providers].sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at)).map(publicProvider),
      stats,
      mockEnabled: true,
      types: ProviderTypes,
    };
  }
  if (route === "POST /admin/providers" || (r = m(/^PUT \/admin\/providers\/([^/]+)$/))) {
    const existing = r ? s.providers.find((p) => p.id === r![1]) : undefined;
    if (r && !existing) throw new LocalError(404, "Provider tidak ditemukan.");
    const b = body ?? {};
    const type = String(b.type ?? "");
    if (!(ProviderTypes as readonly string[]).includes(type)) throw new LocalError(400, "Tipe provider tidak dikenal.");
    if (!String(b.name ?? "").trim()) throw new LocalError(400, "Nama wajib diisi.");
    if (type !== "mock" && !String(b.model ?? "").trim()) throw new LocalError(400, "Model wajib diisi (untuk Azure: nama deployment).");
    if ((type === "azure-openai" || type === "openai-compatible") && !String(b.baseUrl ?? "").trim()) throw new LocalError(400, "Base URL wajib diisi untuk tipe ini.");
    const key = b.clearKey ? "" : String(b.apiKey ?? "").trim() || existing?.api_key || "";
    if (["anthropic", "openai", "gemini", "azure-openai"].includes(type) && !key) throw new LocalError(400, "API key wajib diisi untuk tipe ini.");
    const rec: ProviderRec = {
      id: existing?.id ?? id(),
      name: String(b.name).trim(),
      type,
      model: String(b.model ?? "").trim(),
      base_url: String(b.baseUrl ?? "").trim(),
      api_version: String(b.apiVersion ?? "").trim(),
      api_key: key,
      priority: Number.isFinite(Number(b.priority)) ? Number(b.priority) : 100,
      enabled: b.enabled !== false,
      created_at: existing?.created_at ?? now(),
    };
    s.providers = existing ? s.providers.map((p) => (p.id === rec.id ? rec : p)) : [...s.providers, rec];
    save(s);
    return { provider: publicProvider(rec) };
  }
  if (route === "POST /admin/providers/reorder") {
    (body?.ids as string[]).forEach((pid, i) => {
      const p = s.providers.find((x) => x.id === pid);
      if (p) p.priority = (i + 1) * 10;
    });
    save(s);
    return { ok: true };
  }
  if ((r = m(/^DELETE \/admin\/providers\/([^/]+)$/))) {
    s.providers = s.providers.filter((p) => p.id !== r![1]);
    save(s);
    return { ok: true };
  }
  if ((r = m(/^POST \/admin\/providers\/([^/]+)\/test$/))) {
    const p = s.providers.find((x) => x.id === r![1]);
    if (!p) throw new LocalError(404, "Provider tidak ditemukan.");
    const started = performance.now();
    try {
      await callProvider(toConfig(p), { task: "test", system: "You are a health check. Reply with JSON only.", user: 'Reply with exactly this JSON: {"ok": true}', maxTokens: 50 }, 30_000);
      return { ok: true, latencyMs: Math.round(performance.now() - started) };
    } catch (e: any) {
      return { ok: false, error: hint(p, e?.message ?? String(e)) };
    }
  }
  if (route === "GET /admin/usage") {
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 1), 90);
    const since = Date.now() - days * 86_400_000;
    const rows = s.usage.filter((u) => Date.parse(u.created_at) > since);
    const groups = new Map<string, UsageRec[]>();
    for (const u of rows) groups.set(`${u.provider_name}\u0000${u.model}`, [...(groups.get(`${u.provider_name}\u0000${u.model}`) ?? []), u]);
    const summary = [...groups.values()]
      .map((g) => {
        const ok = g.filter((u) => u.status === "success");
        return {
          provider_name: g[0].provider_name,
          model: g[0].model,
          calls: g.length,
          ok: ok.length,
          errors: g.filter((u) => u.status === "error").length,
          invalid: g.filter((u) => u.status === "invalid_output").length,
          input_tokens: g.reduce((n, u) => n + u.input_tokens, 0),
          output_tokens: g.reduce((n, u) => n + u.output_tokens, 0),
          avg_latency_ms: ok.length ? Math.round(ok.reduce((n, u) => n + u.latency_ms, 0) / ok.length) : null,
        };
      })
      .sort((a, b) => b.calls - a.calls);
    const recent = [...s.usage].reverse().slice(0, 200).map((u) => ({ ...u, email: null }));
    return { days, summary, recent };
  }
  if (route === "GET /admin/users") return { users: [] };

  throw new LocalError(404, "Endpoint tidak ditemukan.");
}

