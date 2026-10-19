import type { CvDocument, CvSection, Profile } from "../shared/schemas.js";

const range = (start: string, end: string) => [start, end].filter(Boolean).join(" - ");

/** Deterministic conversion of the master profile into a CV document (no AI). */
export function profileToCv(profile: Profile): CvDocument {
  const sections: CvSection[] = [];
  const blank = { text: "", skills: [], bullets: [], entries: [] };

  if (profile.summary) sections.push({ ...blank, title: "Summary", kind: "paragraph", text: profile.summary });
  if (profile.skills.length)
    sections.push({ ...blank, title: "Skills", kind: "skills", skills: profile.skills.filter((s) => s.items) });

  const groups = new Map<string, Profile["experience"]>();
  for (const e of profile.experience) {
    const key = e.section || "Work Experience";
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const workFirst = [...groups.keys()].sort((a, b) => Number(b === "Work Experience") - Number(a === "Work Experience"));
  const experienceSections: CvSection[] = workFirst.map((title) => ({
    ...blank,
    title,
    kind: "entries",
    entries: groups.get(title)!.map((e) => ({
      title: [e.organization, e.location].filter(Boolean).join(" - "),
      subtitle: e.role,
      date: range(e.start, e.end),
      bullets: e.bullets,
    })),
  }));

  if (profile.education.length)
    sections.push({
      ...blank,
      title: "Education",
      kind: "entries",
      entries: profile.education.map((e) => ({
        title: [e.institution, e.location].filter(Boolean).join(" - "),
        subtitle: e.degree,
        date: range(e.start, e.end),
        bullets: e.bullets,
      })),
    });
  sections.push(...experienceSections.slice(0, 1));
  if (profile.projects.length)
    sections.push({
      ...blank,
      title: "Projects",
      kind: "entries",
      entries: profile.projects.map((p) => ({
        title: p.name,
        subtitle: [p.role, p.tech].filter(Boolean).join(" - "),
        date: "",
        bullets: p.bullets,
      })),
    });
  sections.push(...experienceSections.slice(1));
  if (profile.certifications.length)
    sections.push({ ...blank, title: "Certifications", kind: "bullets", bullets: profile.certifications });

  const c = profile.contact;
  return {
    name: profile.name || "Your Name",
    headline: profile.headline,
    contact: [c.phone, c.email, c.location, c.linkedin, c.website].filter(Boolean),
    sections,
  };
}

/** Plain-text rendering of a profile, handy for prompts and keyword matching. */
export function profileToText(profile: Profile): string {
  const lines: string[] = [profile.name, profile.headline, profile.summary];
  for (const s of profile.skills) lines.push(`${s.category}: ${s.items}`);
  for (const e of profile.experience) lines.push(`${e.organization} ${e.role}`, ...e.bullets);
  for (const e of profile.education) lines.push(`${e.institution} ${e.degree}`, ...e.bullets);
  for (const p of profile.projects) lines.push(`${p.name} ${p.role} ${p.tech}`, ...p.bullets);
  lines.push(...profile.certifications);
  return lines.filter(Boolean).join("\n");
}
