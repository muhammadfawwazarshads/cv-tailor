import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Validates a route id; malformed ids are treated as "not found". */
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(404, "Data tidak ditemukan.");
  return value;
}

/** Wraps an async handler: the resolved value is sent as JSON, thrown errors go to the error handler. */
export function wrap(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res)
      .then((body) => {
        if (!res.headersSent && body !== undefined) res.json(body);
      })
      .catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => i.message).join(" ");
    return res.status(400).json({ error: msg || "Input tidak valid." });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err && typeof err === "object" && "type" in err && (err as any).type === "entity.too.large") {
    return res.status(413).json({ error: "Data terlalu besar." });
  }
  console.error(err);
  res.status(500).json({ error: "Terjadi kesalahan di server." });
}
