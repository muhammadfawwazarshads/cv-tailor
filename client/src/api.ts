import type { Analysis, Answer, CvDocument, Profile, TailorResult } from "../../server/shared/schemas";

export type { Analysis, Answer, CvDocument, Profile };

export type User = { id: string; email: string; name: string; role: "admin" | "user" };

export type ApplicationSummary = {
  id: string;
  company: string;
  role_title: string;
  status: string;
  cv_language: string;
  created_at: string;
  updated_at: string;
  error: string | null;
  fit_score: number | null;
  verdict: string | null;
  versions: number;
};

export type Application = {
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

export type Version = {
  id: string;
  number: number;
  label: string;
  data: CvDocument;
  notes: Partial<Pick<TailorResult, "changes" | "notClaimed" | "interviewPrep">>;
  created_at: string;
};

export type Fact = { id: string; text: string; created_at: string; application_id: string | null; company?: string | null; role_title?: string | null };

export type Provider = {
  id: string;
  name: string;
  type: string;
  model: string;
  base_url: string;
  api_version: string;
  priority: number;
  enabled: boolean;
  api_key_masked: string;
  has_key: boolean;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const STANDALONE = __STANDALONE__;

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  if (__STANDALONE__) {
    const { localApi, LocalError } = await import("./local/server");
    try {
      // Round-trip through JSON so callers never share objects with the local store.
      const out = await localApi(method, url, body);
      return JSON.parse(JSON.stringify(out)) as T;
    } catch (e: any) {
      if (e instanceof LocalError) throw new ApiError(e.message, e.status);
      if (e?.name === "ZodError") throw new ApiError("Input tidak valid.", 400);
      throw new ApiError(e?.message ?? String(e), 500);
    }
  }
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body && !isForm ? { "content-type": "application/json" } : undefined,
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Permintaan gagal (${res.status})`, res.status);
  return data as T;
}

export const STATUS_LABELS: Record<string, string> = {
  analyzing: "Dianalisis",
  questions: "Perlu konfirmasi",
  tailored: "CV siap",
  applied: "Sudah daftar",
  interview: "Interview",
  offer: "Offer",
  rejected: "Ditolak",
  withdrawn: "Batal",
};

export const STATUS_TONE: Record<string, string> = {
  analyzing: "",
  questions: "gap",
  tailored: "blue",
  applied: "blue",
  interview: "fit",
  offer: "fit",
  rejected: "bad",
  withdrawn: "",
};

export function formatDate(s: string) {
  return new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
