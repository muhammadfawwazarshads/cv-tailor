import { Router } from "express";
import { z } from "zod";
import { extractLeads, MAX_LEADS_SOURCE } from "../ai/service.js";
import { requireAuth, type SessionUser } from "../auth.js";
import { one, query } from "../db/index.js";
import { HttpError, uuid, wrap } from "../http.js";
import { LEAD_INCOMPLETE, leadJobText, leadKey } from "../shared/leads.js";
import { LeadSchema, LeadStatuses, type Lead } from "../shared/schemas.js";
import { createApplication } from "./applications.js";
import { getFacts, getProfile } from "./profile.js";

type LeadRow = {
  id: string;
  data: Lead;
  title: string;
  company: string;
  status: string;
  application_id: string | null;
  created_at: string;
  updated_at: string;
};

async function loadLead(user: SessionUser, id: unknown) {
  const lead = await one<LeadRow>(`SELECT * FROM job_leads WHERE id = $1 AND user_id = $2`, [uuid(id), user.id]);
  if (!lead) throw new HttpError(404, "Lowongan tidak ditemukan.");
  return lead;
}

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

leadsRouter.get(
  "/",
  wrap(async (req) => ({
    leads: await query<LeadRow>(`SELECT * FROM job_leads WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500`, [req.user!.id]),
  })),
);

leadsRouter.post(
  "/extract",
  wrap(async (req, res) => {
    const body = z
      .object({
        text: z.string().trim().min(40, "Teksnya terlalu pendek. Salin seluruh halaman lowongan (Ctrl+A, Ctrl+C).").max(MAX_LEADS_SOURCE * 3),
        preferences: z.string().trim().max(1000).default(""),
      })
      .parse(req.body);
    const profile = await getProfile(req.user!.id);
    if (!profile.name && !profile.experience.length && !profile.summary) {
      throw new HttpError(400, "Profil CV kamu masih kosong. Isi atau impor CV di menu Profil dulu.");
    }
    const result = await extractLeads(req.user!, { profile, facts: await getFacts(req.user!.id), preferences: body.preferences, sourceText: body.text });

    const existing = await query<LeadRow>(`SELECT * FROM job_leads WHERE user_id = $1`, [req.user!.id]);
    const byKey = new Map(existing.map((l) => [leadKey(l.title, l.company), l]));
    const saved: LeadRow[] = [];
    let skipped = 0;
    for (const job of result.data.jobs) {
      const key = leadKey(job.title, job.company);
      const dup = byKey.get(key);
      if (dup) {
        // Re-pasting a job with its full description upgrades a card-only lead.
        if (job.hasDetails && !dup.data.hasDetails) {
          saved.push((await one<LeadRow>(`UPDATE job_leads SET data = $1, updated_at = now() WHERE id = $2 RETURNING *`, [JSON.stringify(job), dup.id]))!);
        } else skipped++;
        continue;
      }
      const row = (await one<LeadRow>(`INSERT INTO job_leads (user_id, data, title, company) VALUES ($1,$2,$3,$4) RETURNING *`, [
        req.user!.id,
        JSON.stringify(job),
        job.title.slice(0, 300),
        job.company.slice(0, 300),
      ]))!;
      byKey.set(key, row);
      saved.push(row);
    }
    res.status(201);
    return { leads: saved, found: result.data.jobs.length, skipped, provider: result.provider };
  }),
);

leadsRouter.patch(
  "/:id",
  wrap(async (req) => {
    const lead = await loadLead(req.user!, req.params.id);
    const body = z.object({ status: z.enum(LeadStatuses).optional(), jobDescription: z.string().max(20_000).optional() }).parse(req.body);
    const data = body.jobDescription !== undefined ? LeadSchema.parse({ ...lead.data, jobDescription: body.jobDescription, hasDetails: body.jobDescription.trim().length > 200 || lead.data.hasDetails }) : lead.data;
    return {
      lead: await one<LeadRow>(`UPDATE job_leads SET status = coalesce($1, status), data = $2, updated_at = now() WHERE id = $3 RETURNING *`, [
        body.status ?? null,
        JSON.stringify(data),
        lead.id,
      ]),
    };
  }),
);

leadsRouter.delete(
  "/:id",
  wrap(async (req) => {
    const lead = await loadLead(req.user!, req.params.id);
    await query(`DELETE FROM job_leads WHERE id = $1`, [lead.id]);
    return { ok: true };
  }),
);

leadsRouter.post(
  "/:id/apply",
  wrap(async (req, res) => {
    const lead = await loadLead(req.user!, req.params.id);
    if (lead.application_id) {
      const existing = await one(`SELECT id FROM applications WHERE id = $1 AND user_id = $2`, [lead.application_id, req.user!.id]);
      if (existing) return { application: existing, existing: true };
    }
    const jd = leadJobText(lead.data);
    if (lead.data.jobDescription.trim().length < 80) {
      throw new HttpError(400, LEAD_INCOMPLETE);
    }
    const { cvLanguage } = z.object({ cvLanguage: z.string().trim().min(2).max(40).default("English") }).parse(req.body ?? {});
    const application = await createApplication(req.user!, { company: lead.data.company, roleTitle: lead.data.title, cvLanguage, jobDescription: jd });
    await query(`UPDATE job_leads SET status = 'applied', application_id = $1, updated_at = now() WHERE id = $2`, [application.id, lead.id]);
    res.status(201);
    return { application };
  }),
);
