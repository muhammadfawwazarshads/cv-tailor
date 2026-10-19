import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { one, query } from "../db/index.js";
import { wrap } from "../http.js";
import { emptyPersonal, ImageDataUrl, PersonalSchema, type Personal } from "../shared/schemas.js";

type Row = { data: unknown; signature: string | null; photo: string | null; updated_at: string };

export async function getPersonal(userId: string) {
  const row = await one<Row>(`SELECT * FROM personal_data WHERE user_id = $1`, [userId]);
  return {
    personal: row ? PersonalSchema.parse(row.data) : emptyPersonal(),
    signature: row?.signature ?? null,
    photo: row?.photo ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export const personalRouter = Router();
personalRouter.use(requireAuth);

personalRouter.get("/", wrap(async (req) => getPersonal(req.user!.id)));

personalRouter.put(
  "/",
  wrap(async (req) => {
    const body = z
      .object({
        personal: PersonalSchema.optional(),
        signature: ImageDataUrl.nullable().optional(),
        photo: ImageDataUrl.nullable().optional(),
      })
      .parse(req.body);
    const current = await getPersonal(req.user!.id);
    const next = {
      personal: body.personal ?? current.personal,
      signature: body.signature === undefined ? current.signature : body.signature,
      photo: body.photo === undefined ? current.photo : body.photo,
    };
    await query(
      `INSERT INTO personal_data (user_id, data, signature, photo) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, signature = EXCLUDED.signature, photo = EXCLUDED.photo, updated_at = now()`,
      [req.user!.id, JSON.stringify(next.personal satisfies Personal), next.signature, next.photo],
    );
    return getPersonal(req.user!.id);
  }),
);
