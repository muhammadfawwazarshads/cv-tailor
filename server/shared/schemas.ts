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

/* ---------- Job leads: jobs found on LinkedIn and elsewhere, before applying ---------- */

export const CompanyTiers = ["large", "mid", "small", "unknown"] as const;
export const LeadRecommendations = ["apply", "try", "skip"] as const;
export const LeadStatuses = ["new", "saved", "dismissed", "applied"] as const;
export type LeadStatus = (typeof LeadStatuses)[number];

const s = (max = 500) => z.string().max(max).catch("").default("");
const list = z.array(z.string().max(500)).catch([]).default([]);

export const LeadSchema = z.object({
  title: z.string().min(1).max(300),
  company: s(300),
  location: s(300),
  workMode: s(50) /* onsite | hybrid | remote | "" */,
  employmentType: s(80),
  seniority: s(80),
  postedAt: s(80),
  applyInfo: s(1000) /* email, link, or instructions such as subject format */,
  deadline: s(80),
  jobDescription: s(20_000),
  hasDetails: z.boolean().catch(false).default(false),
  category: s(80),
  manufacturing: z.boolean().catch(false).default(false),
  companyTier: z.enum(CompanyTiers).catch("unknown").default("unknown"),
  companyNote: s(600),
  redFlags: list,
  fitScore: z.number().min(0).max(100).catch(0).default(0),
  fitReason: s(1200),
  matched: list,
  missing: list,
  recommendation: z.enum(LeadRecommendations).catch("try").default("try"),
});
export type Lead = z.infer<typeof LeadSchema>;

export const LeadsResultSchema = z.object({ jobs: z.array(LeadSchema).max(40).default([]) });
export type LeadsResult = z.infer<typeof LeadsResultSchema>;

/* ---------- Drafts: application email, cover letter, follow-up ---------- */

export const DraftKinds = ["email", "cover_letter", "follow_up"] as const;
export type DraftKind = (typeof DraftKinds)[number];

export const DraftResultSchema = z.object({
  to: z.string().max(300).catch("").default(""),
  subject: z.string().max(300).catch("").default(""),
  variants: z
    .array(z.object({ label: z.string().max(80), body: z.string().min(20).max(12_000) }))
    .min(1)
    .max(3),
  notes: z.array(z.string().max(500)).catch([]).default([]),
});
export type DraftResult = z.infer<typeof DraftResultSchema>;
export type Draft = DraftResult & { kind: DraftKind; language: string; instruction: string; created_at: string };

/* ---------- Personal data for company forms (filled once, reused) ---------- */

const pv = (max = 500) => z.string().max(max).catch("").default("");

/**
 * Remembered answers from company forms ("Golongan darah" -> "B"), so the next form does not ask again.
 * Free-form on purpose: every company's form asks different things.
 */
export const PersonalSchema = z.object({
  items: z.array(z.object({ label: pv(200), value: pv(2000) })).max(200).catch([]).default([]),
});
export type Personal = z.infer<typeof PersonalSchema>;
export const emptyPersonal = (): Personal => PersonalSchema.parse({});

/** Images are stored as data URLs; keep them small. */
export const ImageDataUrl = z
  .string()
  .max(1_500_000, "Gambar terlalu besar (maks sekitar 1 MB).")
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Format gambar harus PNG atau JPG.");

/* ---------- Company form filling ---------- */

export const FormQuestionSchema = z.object({
  id: z.string().max(20),
  question: z.string().max(500),
  why: z.string().max(300).catch("").default(""),
  saveAs: z.string().max(200).catch("").default(""),
  options: z.array(z.string().max(200)).max(20).catch([]).default([]),
  multi: z.boolean().catch(false).default(false),
  slotIds: z.array(z.string().max(20)).max(20).catch([]).default([]),
  find: z.string().max(500).catch("").default(""),
  template: z.string().max(1000).catch("").default(""),
});
export type FormQuestion = z.infer<typeof FormQuestionSchema>;

export const FormPlanSchema = z.object({
  values: z.array(z.object({ id: z.string().max(20), value: z.string().max(4000) })).max(500).catch([]).default([]),
  checks: z.array(z.string().max(20)).max(300).catch([]).default([]),
  replacements: z.array(z.object({ find: z.string().max(500), replace: z.string().max(1000) })).max(60).catch([]).default([]),
  questions: z.array(FormQuestionSchema).max(40).catch([]).default([]),
  skipped: z.array(z.object({ label: z.string().max(300), reason: z.string().max(300).catch("").default("") })).max(100).catch([]).default([]),
  notes: z.array(z.string().max(500)).max(10).catch([]).default([]),
});
export type FormPlan = z.infer<typeof FormPlanSchema>;
