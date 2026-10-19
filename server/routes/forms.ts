import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { formContext, planForm } from "../ai/service.js";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";
import { HttpError, wrap } from "../http.js";
import { dataUrlToBytes, fillForm, parseForm } from "../shared/docxform.js";
import { getFacts, getProfile } from "./profile.js";
import { getPersonal } from "./personal.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 } });

function docxFile(req: { file?: Express.Multer.File }) {
  const f = req.file;
  if (!f) throw new HttpError(400, "Pilih file form (.docx).");
  if (!/\.docx$/i.test(f.originalname)) throw new HttpError(400, "Saat ini hanya form Word .docx yang bisa diisi. Simpan ulang .doc atau PDF sebagai .docx dulu.");
  return f;
}

async function parse(buf: Buffer) {
  try {
    return await parseForm(buf);
  } catch (e: any) {
    throw new HttpError(400, e?.message ?? "Form tidak terbaca.");
  }
}

export const formsRouter = Router();
formsRouter.use(requireAuth);

/** Reads the form and lets the AI fill what it can and list what it needs to ask. */
formsRouter.post(
  "/analyze",
  upload.single("file"),
  wrap(async (req) => {
    const file = docxFile(req);
    const form = await parse(file.buffer);
    if (!form.slots.length) throw new HttpError(400, "Tidak ada isian yang terdeteksi di form ini.");
    const [profile, facts, personal] = await Promise.all([getProfile(req.user!.id), getFacts(req.user!.id), getPersonal(req.user!.id)]);
    const ctx = formContext(form, profile, facts, personal.personal.items, { hasSignature: Boolean(personal.signature), hasPhoto: Boolean(personal.photo) });
    const res = await planForm(req.user!, ctx, { form, saved: personal.personal.items, hasSignature: Boolean(personal.signature) });
    return { slots: form.slots, plan: res.data, provider: res.provider };
  }),
);

const FillBody = z.object({
  values: z.record(z.string(), z.string().max(4000)).default({}),
  checks: z.array(z.string().max(20)).max(300).default([]),
  replacements: z.array(z.object({ find: z.string().max(500), replace: z.string().max(1000) })).max(80).default([]),
});

/** Writes the answers into the form and returns the filled .docx (base64). */
formsRouter.post(
  "/fill",
  upload.single("file"),
  wrap(async (req) => {
    const file = docxFile(req);
    let raw: unknown;
    try {
      raw = JSON.parse(String(req.body?.fill ?? "{}"));
    } catch {
      throw new HttpError(400, "Data isian tidak valid.");
    }
    const fill = FillBody.parse(raw);
    const personal = await getPersonal(req.user!.id);
    const out = await fillForm(file.buffer, fill, { signature: dataUrlToBytes(personal.signature), photo: dataUrlToBytes(personal.photo) });
    const name = file.originalname.replace(/\.docx$/i, "") + " - terisi.docx";
    return { file: Buffer.from(out.file).toString("base64"), filename: name, filled: out.filled };
  }),
);
