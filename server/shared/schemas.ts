import { z } from "zod";

/* ---------- Master profile: everything the user has ever done ---------- */

const str = (max = 4000) => z.string().max(max).default("");
const bullets = z.array(z.string().max(2000)).default([]);

export const ExperienceSchema = z.object({
  id: z.string().default(""),
  /** Section the entry belongs to, e.g. "Work Experience" or "Product Design & UX Research Experience". */
  section: str(200).transform((s) => s || "Work Experience"),
  organization: str(300),
  role: str(300),
  location: str(200),
  start: str(50),
  end: str(50),
  bullets,
});

export const EducationSchema = z.object({
  id: z.string().default(""),
  institution: str(300),
  location: str(200),
  degree: str(300),
  start: str(50),
  end: str(50),
  bullets,
});

export const ProjectSchema = z.object({
  id: z.string().default(""),
  name: str(300),
  role: str(300),
  tech: str(500),
  link: str(500),
  bullets,
});

export const SkillGroupSchema = z.object({
  category: str(200),
  items: str(2000),
});

export const ProfileSchema = z.object({
  name: str(200),
  headline: str(300),
  contact: z
    .object({
      email: str(200),
      phone: str(100),
      website: str(300),
      linkedin: str(300),
      location: str(200),
    })
    .default({ email: "", phone: "", website: "", linkedin: "", location: "" }),
  summary: str(4000),
  skills: z.array(SkillGroupSchema).default([]),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  certifications: z.array(z.string().max(500)).default([]),
});
export type Profile = z.infer<typeof ProfileSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;

export const emptyProfile = (): Profile => ProfileSchema.parse({});

/* ---------- Job fit analysis ---------- */

export const AnalysisSchema = z.object({
  fitScore: z.number().min(0).max(100),
  verdict: z.string(),
  summary: z.string(),
  focus: z.array(z.string()).default([]),
  strengths: z.array(z.object({ point: z.string(), evidence: z.string().default("") })).default([]),
  gaps: z
    .array(
      z.object({
        point: z.string(),
        severity: z.enum(["high", "medium", "low"]).catch("medium"),
        advice: z.string().default(""),
      }),
    )
    .default([]),
  questions: z
    .array(z.object({ id: z.string(), question: z.string(), reason: z.string().default("") }))
    .default([]),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

/* ---------- Rendered CV document ---------- */

export const CvEntrySchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  date: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const CvSectionSchema = z.object({
  title: z.string(),
  kind: z.enum(["paragraph", "skills", "bullets", "entries"]),
  text: z.string().default(""),
  skills: z.array(z.object({ category: z.string(), items: z.string() })).default([]),
  bullets: z.array(z.string()).default([]),
  entries: z.array(CvEntrySchema).default([]),
});

export const CvDocumentSchema = z.object({
  name: z.string(),
  headline: z.string().default(""),
  contact: z.array(z.string()).default([]),
  sections: z.array(CvSectionSchema),
});
export type CvDocument = z.infer<typeof CvDocumentSchema>;
export type CvSection = z.infer<typeof CvSectionSchema>;

export const TailorResultSchema = z.object({
  cv: CvDocumentSchema,
  changes: z.array(z.string()).default([]),
  notClaimed: z.array(z.string()).default([]),
  interviewPrep: z.array(z.string()).default([]),
});
export type TailorResult = z.infer<typeof TailorResultSchema>;

/* ---------- Misc ---------- */

export const ProviderTypes = ["anthropic", "openai", "gemini", "azure-openai", "openai-compatible", "mock"] as const;
export type ProviderType = (typeof ProviderTypes)[number];

export const ApplicationStatuses = [
  "analyzing",
  "questions",
  "tailored",
  "applied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof ApplicationStatuses)[number];

export type Answer = { questionId: string; question: string; answer: string };
