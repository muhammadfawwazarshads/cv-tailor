import type { FormSlot } from "../../server/shared/docxform";
import type { Analysis, Answer, CvDocument, Draft, FormPlan, FormQuestion, Lead, Personal, Profile, TailorResult } from "../../server/shared/schemas";

export type { Analysis, Answer, CvDocument, Draft, FormPlan, FormQuestion, FormSlot, Lead, Personal, Profile };

export type PersonalData = { personal: Personal; signature: string | null; photo: string | null; updatedAt: string | null };

export type LeadRow = {
  id: string;
  data: Lead;
  title: string;
  company: string;
  status: "new" | "saved" | "dismissed" | "applied";
  application_id: string | null;
  created_at: string;
  updated_at: string;
};

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
  drafts?: Draft[];
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

/** Saves a base64 file (from the API) with the browser's download dialog. */
export function downloadBase64(base64: string, filename: string, type: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
