import type { SessionUser } from "../auth.js";
import { callJson } from "../llm/router.js";
import {
  AnalysisSchema,
  DraftResultSchema,
  LeadsResultSchema,
  ProfileSchema,
  TailorResultSchema,
  type Analysis,
  type Answer,
  type CvDocument,
  type Profile,
  type TailorResult,
} from "../shared/schemas.js";
import { analyzePrompt, draftPrompt, extractProfilePrompt, leadsPrompt, revisePrompt, tailorPrompt } from "./prompts.js";

const MAX_SOURCE = 60_000;

const answersText = (answers: Answer[]) =>
  answers
    .filter((a) => a.answer.trim())
    .map((a) => `Q: ${a.question}\nA: ${a.answer.trim()}`)
    .join("\n\n");

/** Drops empty fields so prompts stay compact. */
const compact = (value: unknown) =>
  JSON.stringify(value, (_k, v) => (v === "" || (Array.isArray(v) && v.length === 0) ? undefined : v));

type JobCtx = { profile: Profile; facts: string[]; jobDescription: string; company: string; role: string };

export async function extractProfile(user: SessionUser, sourceText: string) {
  const text = sourceText.slice(0, MAX_SOURCE);
  const p = extractProfilePrompt(text);
  const res = await callJson(user, { task: "extract_profile", ...p, maxTokens: 12_000, meta: { sourceText: text } }, ProfileSchema);
  res.data.experience.forEach((e, i) => (e.id ||= `exp-${i + 1}`));
  res.data.education.forEach((e, i) => (e.id ||= `edu-${i + 1}`));
  res.data.projects.forEach((e, i) => (e.id ||= `proj-${i + 1}`));
  return res;
}

export async function analyzeJob(user: SessionUser, ctx: JobCtx & { answers: Answer[] }) {
  const p = analyzePrompt({ ...ctx, profileJson: compact(ctx.profile), answers: answersText(ctx.answers) });
  return callJson(user, { task: "analyze", ...p, maxTokens: 6_000, meta: ctx }, AnalysisSchema);
}

export async function tailorCv(user: SessionUser, ctx: JobCtx & { answers: Answer[]; analysis: Analysis | null; cvLanguage: string }) {
  const p = tailorPrompt({
    ...ctx,
    profileJson: compact(ctx.profile),
    answers: answersText(ctx.answers),
    analysisJson: compact(ctx.analysis ?? {}),
  });
  return callJson(user, { task: "tailor", ...p, maxTokens: 16_000, meta: ctx }, TailorResultSchema);
}

export async function reviseCv(
  user: SessionUser,
  ctx: JobCtx & { cv: CvDocument; notes: Partial<TailorResult>; instruction: string; cvLanguage: string },
) {
  const p = revisePrompt({
    ...ctx,
    profileJson: compact(ctx.profile),
    cvJson: JSON.stringify(ctx.cv),
    notesJson: JSON.stringify({ notClaimed: ctx.notes.notClaimed ?? [], interviewPrep: ctx.notes.interviewPrep ?? [] }),
  });
  return callJson(user, { task: "revise", ...p, maxTokens: 16_000, meta: ctx }, TailorResultSchema);
}

export const MAX_LEADS_SOURCE = 40_000;

export async function extractLeads(user: SessionUser, ctx: { profile: Profile; facts: string[]; preferences: string; sourceText: string }) {
  const sourceText = ctx.sourceText.slice(0, MAX_LEADS_SOURCE);
  const p = leadsPrompt({ ...ctx, sourceText, profileJson: compact(ctx.profile) });
  return callJson(user, { task: "extract_leads", ...p, maxTokens: 16_000, meta: { ...ctx, sourceText } }, LeadsResultSchema);
}

export function signatureOf(profile: Profile) {
  const c = profile.contact;
  return [profile.name, c.phone, c.email, c.linkedin || c.website].filter(Boolean).join("\n");
}

export async function draftMessage(
  user: SessionUser,
  ctx: JobCtx & { kind: string; language: string; instruction: string; cv: CvDocument | null },
) {
  const p = draftPrompt({
    ...ctx,
    profileJson: compact(ctx.profile),
    cvJson: ctx.cv ? JSON.stringify(ctx.cv) : "",
    signature: signatureOf(ctx.profile),
  });
  return callJson(user, { task: `draft_${ctx.kind}`, ...p, maxTokens: 6_000, meta: { ...ctx, signature: signatureOf(ctx.profile) } }, DraftResultSchema);
}
