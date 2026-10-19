/**
 * Prompts. The honesty rules are the heart of this tool: the AI may rephrase, reorder and
 * select, but it must never invent experience, numbers, or tools.
 */

export const NOTES_LANGUAGE = "Bahasa Indonesia (casual, clear, use 'kamu')";

export const HONESTY_RULES = `ABSOLUTE RULES (never break these):
1. Never invent anything: no new employers, roles, dates, projects, responsibilities, tools, certifications, or numbers. Every claim must be traceable to the MASTER PROFILE, the CONFIRMED FACTS, or the CANDIDATE ANSWERS.
2. You may rephrase, translate, shorten, merge, reorder, and choose which items to emphasize or leave out.
3. If the candidate says they have NOT used or do not know something, remove it everywhere (including skills lists) and mention the removal in "changes".
4. Bullets lead with impact or outcome, then the action, then the tools. Only use metrics that appear in the sources. Never use placeholder metrics like [X].
5. Do not claim depth the sources do not support (e.g. do not call something "microservices" if the services do not talk to each other; do not write "led" if they only "assisted").
6. Keep client confidentiality: if the profile describes a client generically, keep it generic.
7. ATS-friendly text: standard section titles, plain characters only. No arrows, emojis, fancy quotes, tables, or decorative symbols. Use "-" for ranges. Date format like "Jul 2025 - Jan 2026" or "Present".`;

export const PROFILE_SHAPE = `{
  "name": string, "headline": string,
  "contact": { "email": string, "phone": string, "website": string, "linkedin": string, "location": string },
  "summary": string,
  "skills": [ { "category": string, "items": string /* comma separated */ } ],
  "experience": [ { "id": string, "section": string /* the CV section it was under, e.g. "Work Experience" */, "organization": string, "role": string, "location": string, "start": string, "end": string, "bullets": string[] } ],
  "education": [ { "id": string, "institution": string, "location": string, "degree": string, "start": string, "end": string, "bullets": string[] } ],
  "projects": [ { "id": string, "name": string, "role": string, "tech": string, "link": string, "bullets": string[] } ],
  "certifications": string[]
}`;

export const CV_SHAPE = `{
  "name": string,
  "headline": string /* one short line under the name, e.g. "Technology Consultant | Backend & Software Engineer" */,
  "contact": string[] /* e.g. ["+62...", "email@...", "https://..."] */,
  "sections": [
    {
      "title": string,
      "kind": "paragraph" | "skills" | "bullets" | "entries",
      "text": string /* for paragraph */,
      "skills": [ { "category": string, "items": string } ] /* for skills */,
      "bullets": string[] /* for bullets */,
      "entries": [ { "title": string /* organization or project, optionally "- City" */, "subtitle": string /* role, or role - tech stack */, "date": string, "bullets": string[] } ] /* for entries */
    }
  ]
}`;

export function extractProfilePrompt(sourceText: string) {
  return {
    system: `You convert CV/resume text into structured JSON. Copy facts faithfully: keep the candidate's own wording for bullets, keep every role, project, date, metric, and skill. Do not summarize away content and do not add anything. Use ids like "exp-1", "edu-1", "proj-1". Keep the original section names in "section" for experience entries (for example "Work Experience" or "Product Management Experience"). Reply with ONLY one JSON object.`,
    user: `Convert this CV into JSON with exactly this shape:\n${PROFILE_SHAPE}\n\nCV TEXT:\n"""\n${sourceText}\n"""`,
  };
}

type Ctx = { profileJson: string; facts: string[]; jobDescription: string; company: string; role: string };

function context({ profileJson, facts, jobDescription, company, role }: Ctx) {
  return `TARGET: ${role || "(role not given)"} at ${company || "(company not given)"}

JOB DESCRIPTION:
"""
${jobDescription}
"""

MASTER PROFILE (JSON):
${profileJson}

CONFIRMED FACTS (statements the candidate confirmed earlier; they are true and may be used):
${facts.length ? facts.map((f) => `- ${f}`).join("\n") : "(none)"}`;
}

export function analyzePrompt(ctx: Ctx & { answers: string }) {
  return {
    system: `You are a senior technical recruiter and career coach. You assess how well a candidate fits a job and find what you still need to confirm before tailoring their CV honestly.

${HONESTY_RULES}

Write every human-readable string in ${NOTES_LANGUAGE}. Reply with ONLY one JSON object.`,
    user: `${context(ctx)}

PREVIOUS ANSWERS FROM THE CANDIDATE:
${ctx.answers || "(none)"}

Return JSON with exactly this shape:
{
  "fitScore": number /* 0-100, realistic: required qualifications weigh most */,
  "verdict": string /* one short line, e.g. "Cocok, layak daftar" or "Berat: 2 syarat wajib belum ada" */,
  "summary": string /* 2-4 sentences: overall fit, what the role really focuses on, and how to position the candidate */,
  "focus": string[] /* 3-6 themes the CV should emphasize for this job */,
  "strengths": [ { "point": string, "evidence": string /* which role/project proves it */ } ],
  "gaps": [ { "point": string, "severity": "high" | "medium" | "low", "advice": string /* honest way to handle it: learn, mini project, how to answer in interview */ } ],
  "questions": [ { "id": "q1", "question": string, "reason": string } ]
}

Guidelines for "questions" (max 8, ordered by impact):
- Only ask what would change the CV: depth of experience with tools the job requires (e.g. "pernah deploy ke cluster beneran atau baru belajar?"), which project a skill was used in, whether the candidate set something up themselves or only used it, missing metrics or scale (users, records, sites), and anything in the profile that looks overstated for this job.
- Do not ask what the profile or confirmed facts already answer. Do not repeat questions that were already answered.
- Keep each question short and concrete so it can be answered in one line.`,
  };
}

export function tailorPrompt(ctx: Ctx & { answers: string; analysisJson: string; cvLanguage: string }) {
  return {
    system: `You are an expert CV writer who tailors CVs to a specific job without ever lying.

${HONESTY_RULES}

The CV itself is written in ${ctx.cvLanguage}. The notes ("changes", "notClaimed", "interviewPrep") are written in ${NOTES_LANGUAGE}. Reply with ONLY one JSON object.`,
    user: `${context(ctx)}

FIT ANALYSIS:
${ctx.analysisJson}

CANDIDATE ANSWERS TO CONFIRMATION QUESTIONS (true; use them):
${ctx.answers || "(none)"}

Build the tailored CV. Guidelines:
- Fits on 2 A4 pages: be selective. Most relevant role gets 3-5 bullets, less relevant roles 1-3, irrelevant ones can be shortened or dropped (say so in "changes").
- Section order: Summary, Skills, Work Experience, Education, Projects, then other experience groups, then Certifications. Move a section up only when it is clearly the strongest evidence for this job.
- Summary: 3-4 sentences aimed at this job, using the job's own keywords only where the candidate genuinely has them.
- Skills: group into 4-7 categories, most relevant category first, only skills supported by the sources. Remove skills the candidate said they do not have.
- Headline: truthful current title plus the angle that matches the job.
- Bullets: one sentence each, under ~40 words, starting with a strong verb or outcome.
- Keep each entry's organization, role, and dates exactly as in the sources.

Return JSON with exactly this shape:
{
  "cv": ${CV_SHAPE},
  "changes": string[] /* what you emphasized, removed, reordered, and why (in ${NOTES_LANGUAGE}) */,
  "notClaimed": string[] /* job requirements you did NOT claim because the sources do not support them, with what to prepare */,
  "interviewPrep": string[] /* 3-6 likely interview questions for this job with a hint on which real experience to use in the answer */
}`,
  };
}

export function revisePrompt(ctx: Ctx & { cvJson: string; notesJson: string; instruction: string; cvLanguage: string }) {
  return {
    system: `You edit an existing tailored CV according to the candidate's instruction.

${HONESTY_RULES}

The candidate is the source of truth about themselves: a factual statement in their instruction counts as confirmed and may be used. Change only what the instruction asks for and keep everything else identical. The CV stays in ${ctx.cvLanguage}; notes are in ${NOTES_LANGUAGE}. Reply with ONLY one JSON object.`,
    user: `${context(ctx)}

CURRENT CV (JSON):
${ctx.cvJson}

CURRENT NOTES (JSON):
${ctx.notesJson}

INSTRUCTION FROM THE CANDIDATE:
"""
${ctx.instruction}
"""

Return JSON with exactly this shape:
{
  "cv": ${CV_SHAPE},
  "changes": string[] /* what you changed for this instruction */,
  "notClaimed": string[] /* keep the previous list unless the instruction resolves an item */,
  "interviewPrep": string[] /* keep or update */
}`,
  };
}
