import type { Lead } from "./schemas.js";

/** Key used to detect the same job pasted twice. */
export const leadKey = (title: string, company: string) =>
  [title, company].map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).join("|");

/** The text used as the job description when a lead becomes an application. */
export function leadJobText(lead: Lead): string {
  const head = [
    lead.title && `Position: ${lead.title}`,
    lead.company && `Company: ${lead.company}`,
    lead.location && `Location: ${lead.location}${lead.workMode ? ` (${lead.workMode})` : ""}`,
    lead.employmentType && `Employment type: ${lead.employmentType}`,
    lead.seniority && `Seniority: ${lead.seniority}`,
    lead.applyInfo && `How to apply: ${lead.applyInfo}`,
  ].filter(Boolean);
  return [...head, "", lead.jobDescription].join("\n").trim();
}

export const LEAD_INCOMPLETE =
  'Deskripsi lowongan ini belum lengkap. Buka lowongannya, salin deskripsinya, lalu tempel di kotak "Lengkapi deskripsi".';
