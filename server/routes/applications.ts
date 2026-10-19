import { Router } from "express";
import { z } from "zod";
import { analyzeJob, reviseCv, tailorCv } from "../ai/service.js";
import { requireAuth, type SessionUser } from "../auth.js";
import { one, query } from "../db/index.js";
import { HttpError, uuid, wrap } from "../http.js";
import { pdfFileName, renderCvPdf } from "../pdf/render.js";
import {
  AnalysisSchema,
  ApplicationStatuses,
  CvDocumentSchema,
  type Analysis,
  type Answer,
  type CvDocument,
  type TailorResult,
} from "../shared/schemas.js";
import { getFacts, getProfile } from "./profile.js";

type AppRow = {
  id: string;
  user_id: string;
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

type VersionRow = { id: string; number: number; label: string; data: CvDocument; notes: Partial<TailorResult>; created_at: string };


async function loadApp(user: SessionUser, id: unknown): Promise<AppRow> {
  const app = await one<AppRow>(`SELECT * FROM applications WHERE id = $1 AND user_id = $2`, [uuid(id), user.id]);
  if (!app) throw new HttpError(404, "Lamaran tidak ditemukan.");
  return app;
}

async function loadVersion(app: AppRow, id: unknown): Promise<VersionRow> {
  const v = await one<VersionRow>(`SELECT * FROM cv_versions WHERE id = $1 AND application_id = $2`, [uuid(id), app.id]);
  if (!v) throw new HttpError(404, "Versi CV tidak ditemukan.");
  return v;
}

async function jobContext(user: SessionUser, app: AppRow) {
  const profile = await getProfile(user.id);
  if (!profile.name && !profile.experience.length && !profile.summary) {
    throw new HttpError(400, "Profil CV kamu masih kosong. Isi atau impor CV di menu Profil dulu.");
  }
  return {
    profile,
    facts: await getFacts(user.id),
    jobDescription: app.job_description,
    company: app.company,
    role: app.role_title,
  };
}

async function saveVersion(app: AppRow, user: SessionUser, label: string, result: TailorResult) {
  const next = (await one<{ n: number }>(`SELECT coalesce(max(number), 0)::int + 1 AS n FROM cv_versions WHERE application_id = $1`, [app.id]))!.n;
  const notes = { changes: result.changes, notClaimed: result.notClaimed, interviewPrep: result.interviewPrep };
  const version = await one<VersionRow>(
    `INSERT INTO cv_versions (application_id, user_id, number, label, data, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [app.id, user.id, next, label.slice(0, 200), JSON.stringify(result.cv), JSON.stringify(notes)],
  );
  await query(`UPDATE applications SET status = CASE WHEN status IN ('analyzing','questions') THEN 'tailored' ELSE status END, updated_at = now() WHERE id = $1`, [app.id]);
  return version!;
}

async function runAnalysis(user: SessionUser, app: AppRow) {
  try {
    const res = await analyzeJob(user, { ...(await jobContext(user, app)), answers: app.answers });
    return await one<AppRow>(
      `UPDATE applications SET analysis = $1, error = NULL, status = CASE WHEN status = 'analyzing' THEN 'questions' ELSE status END, updated_at = now()
        WHERE id = $2 RETURNING *`,
      [JSON.stringify(res.data), app.id],
    );
  } catch (e: any) {
    await query(`UPDATE applications SET error = $1, updated_at = now() WHERE id = $2`, [String(e?.message ?? e).slice(0, 2000), app.id]);
    throw e;
  }
}

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

applicationsRouter.get(
  "/",
  wrap(async (req) => ({
    applications: await query(
      `SELECT a.id, a.company, a.role_title, a.status, a.cv_language, a.created_at, a.updated_at, a.error,
              (a.analysis->>'fitScore')::int AS fit_score, a.analysis->>'verdict' AS verdict,
              (SELECT count(*)::int FROM cv_versions v WHERE v.application_id = a.id) AS versions
         FROM applications a WHERE a.user_id = $1 ORDER BY a.updated_at DESC`,
      [req.user!.id],
    ),
  })),
);

const CreateBody = z.object({
  company: z.string().trim().max(200).default(""),
  roleTitle: z.string().trim().max(200).default(""),
  cvLanguage: z.string().trim().min(2).max(40).default("English"),
  jobDescription: z.string().trim().min(80, "Deskripsi pekerjaan terlalu pendek. Tempel JD lengkapnya.").max(30_000),
});

/** Saves a new application and runs the first analysis. A failed analysis keeps the application so it can be retried. */
export async function createApplication(user: SessionUser, input: z.input<typeof CreateBody>) {
  const body = CreateBody.parse(input);
  await jobContext(user, { job_description: body.jobDescription } as AppRow); // fail fast on empty profile
  const app = (await one<AppRow>(
    `INSERT INTO applications (user_id, company, role_title, job_description, cv_language) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [user.id, body.company, body.roleTitle, body.jobDescription, body.cvLanguage],
  ))!;
  try {
    return (await runAnalysis(user, app))!;
  } catch (e: any) {
    return { ...app, error: String(e?.message ?? e) };
  }
}

applicationsRouter.post(
  "/",
  wrap(async (req, res) => {
    const application = await createApplication(req.user!, req.body);
    res.status(201);
    return { application };
  }),
);

applicationsRouter.get(
  "/:id",
  wrap(async (req) => {
    const app = await loadApp(req.user!, req.params.id);
    const versions = await query<VersionRow>(
      `SELECT id, number, label, data, notes, created_at FROM cv_versions WHERE application_id = $1 ORDER BY number DESC`,
      [app.id],
    );
    return { application: app, versions };
  }),
);

applicationsRouter.patch(
  "/:id",
  wrap(async (req) => {
    const app = await loadApp(req.user!, req.params.id);
    const body = z
      .object({
        status: z.enum(ApplicationStatuses).optional(),
        company: z.string().trim().max(200).optional(),
        roleTitle: z.string().trim().max(200).optional(),
        cvLanguage: z.string().trim().min(2).max(40).optional(),
      })
      .parse(req.body);
    const updated = await one<AppRow>(
      `UPDATE applications SET status = coalesce($1, status), company = coalesce($2, company), role_title = coalesce($3, role_title),
              cv_language = coalesce($4, cv_language), updated_at = now() WHERE id = $5 RETURNING *`,
      [body.status ?? null, body.company ?? null, body.roleTitle ?? null, body.cvLanguage ?? null, app.id],
    );
    return { application: updated };
  }),
);

applicationsRouter.delete(
  "/:id",
  wrap(async (req) => {
    const app = await loadApp(req.user!, req.params.id);
    await query(`DELETE FROM applications WHERE id = $1`, [app.id]);
    return { ok: true };
  }),
);

applicationsRouter.post(
  "/:id/analyze",
  wrap(async (req) => {
    const app = await loadApp(req.user!, req.params.id);
    return { application: await runAnalysis(req.user!, app) };
  }),
);

applicationsRouter.post(
  "/:id/answers",
  wrap(async (req) => {
    const app = await loadApp(req.user!, req.params.id);
    const body = z
      .object({
        answers: z
          .array(
            z.object({
              questionId: z.string().max(50),
              question: z.string().max(1000),
              answer: z.string().max(4000),
              saveAsFact: z.boolean().default(false),
            }),
          )
          .max(30),
      })
      .parse(req.body);

    const merged = new Map(app.answers.map((a) => [a.questionId, a]));
    for (const a of body.answers) {
      if (a.answer.trim()) merged.set(a.questionId, { questionId: a.questionId, question: a.question, answer: a.answer.trim() });
      else merged.delete(a.questionId);
    }
    for (const a of body.answers.filter((x) => x.saveAsFact && x.answer.trim())) {
      await query(`INSERT INTO facts (user_id, text, application_id) VALUES ($1, $2, $3)`, [
        req.user!.id,
        `${a.answer.trim()} (menjawab: "${a.question}")`,
        app.id,
      ]);
    }
    const updated = await one<AppRow>(`UPDATE applications SET answers = $1, updated_at = now() WHERE id = $2 RETURNING *`, [
      JSON.stringify([...merged.values()]),
      app.id,
    ]);
    return { application: updated };
  }),
);

applicationsRouter.post(
  "/:id/tailor",
  wrap(async (req) => {
    const app = await loadApp(req.user!, req.params.id);
    const ctx = await jobContext(req.user!, app);
    const analysis = app.analysis ? AnalysisSchema.parse(app.analysis) : null;
    const res = await tailorCv(req.user!, { ...ctx, answers: app.answers, analysis, cvLanguage: app.cv_language });
    const version = await saveVersion(app, req.user!, `Disesuaikan AI (${res.provider})`, res.data);
    return { version, provider: res.provider };
  }),
);

applicationsRouter.post(
  "/:id/versions/:vid/revise",
  wrap(async (req) => {
    const app = await loadApp(req.user!, req.params.id);
    const v = await loadVersion(app, req.params.vid);
    const { instruction, saveAsFact } = z
      .object({ instruction: z.string().trim().min(3, "Instruksi terlalu pendek.").max(4000), saveAsFact: z.boolean().default(false) })
      .parse(req.body);
    const ctx = await jobContext(req.user!, app);
    const res = await reviseCv(req.user!, { ...ctx, cv: v.data, notes: v.notes, instruction, cvLanguage: app.cv_language });
    if (saveAsFact) await query(`INSERT INTO facts (user_id, text, application_id) VALUES ($1,$2,$3)`, [req.user!.id, instruction, app.id]);
    const version = await saveVersion(app, req.user!, `Revisi: ${instruction}`, res.data);
    return { version, provider: res.provider };
  }),
);

applicationsRouter.put(
  "/:id/versions/:vid",
  wrap(async (req) => {
    const app = await loadApp(req.user!, req.params.id);
    const v = await loadVersion(app, req.params.vid);
    const cv = CvDocumentSchema.parse(req.body?.cv);
    const version = await saveVersion(app, req.user!, `Edit manual dari versi ${v.number}`, {
      cv,
      changes: ["Diedit manual."],
      notClaimed: v.notes.notClaimed ?? [],
      interviewPrep: v.notes.interviewPrep ?? [],
    });
    return { version };
  }),
);

applicationsRouter.get(
  "/:id/versions/:vid/pdf",
  wrap(async (req, res) => {
    const app = await loadApp(req.user!, req.params.id);
    const v = await loadVersion(app, req.params.vid);
    const pdf = await renderCvPdf(CvDocumentSchema.parse(v.data));
    const name = pdfFileName(v.data, app.company);
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", `${req.query.inline ? "inline" : "attachment"}; filename="${name}"`);
    res.send(pdf);
    return undefined;
  }),
);
