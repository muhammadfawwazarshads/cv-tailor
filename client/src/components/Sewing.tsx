import { Check } from "lucide-react";
import { Mascot } from "./Mascot";

/**
 * The workshop vocabulary that runs through the app: every application is a garment that gets
 * measured (fit analysis), fitted (confirmation answers), sewn (a tailored CV) and sent.
 * Done stages are stitched in Benang's thread; the rest are still tailor's chalk.
 */
export const SEW_STEPS = ["Ukur", "Pas", "Jahit", "Kirim"] as const;
export const SEW_HINTS = ["Lowongan diukur, skor kecocokan keluar", "Pertanyaan konfirmasi dijawab", "CV dijahit untuk lowongan ini", "Lamaran dikirim"];

const SENT = ["applied", "interview", "offer", "rejected"];

/** Which stages an application has finished, from what the API already returns. */
export function sewProgress(x: { measured: boolean; status: string; versions: number }): boolean[] {
  const fitted = x.measured && x.status !== "questions" && x.status !== "analyzing";
  const sewn = x.versions > 0;
  const sent = SENT.includes(x.status);
  return [x.measured, fitted || sewn || sent, sewn || sent, sent];
}

export function SewTrack({ done, compact, onStep }: { done: boolean[]; compact?: boolean; onStep?: (i: number) => void }) {
  const current = done.findIndex((d) => !d);
  return (
    <ol className={`sew-track${compact ? " compact" : ""}`} aria-label="Tahap lamaran">
      {SEW_STEPS.map((label, i) => {
        const state = done[i] ? "done" : i === current ? "now" : "todo";
        const Tag = onStep ? "button" : "span";
        return (
          <li key={label} className={`sew-stop ${state}`}>
            {i > 0 && <span className={`sew-thread${done[i] ? " sewn" : ""}`} aria-hidden />}
            <Tag
              className="sew-knot"
              {...(onStep ? { type: "button" as const, onClick: () => onStep(i) } : {})}
              title={`${label}: ${SEW_HINTS[i]}${state === "done" ? " (selesai)" : state === "now" ? " (berikutnya)" : ""}`}
            >
              {state === "done" ? <Check size={compact ? 8 : 12} strokeWidth={3} /> : state === "now" ? <Needle /> : null}
            </Tag>
            {!compact && <span className="sew-label">{label}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Needle() {
  return (
    <svg className="sew-needle" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 20 L17.5 6.5 L20 4 L18.5 7.5 L5 21 Q3.5 21.5 4 20 Z" fill="currentColor" />
      <ellipse cx="6.2" cy="18.2" rx="1.6" ry="0.7" transform="rotate(-45 6.2 18.2)" fill="#11141e" />
    </svg>
  );
}

/** Fit score on a tailor's tape measure: ticks every 2%, numbers every 20, a marker at the score. */
export function TapeMeasure({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="tape" role="img" aria-label={`Kecocokan ${v} dari 100`}>
      <div className="tape-strip">
        <span className="tape-fill" style={{ width: `${v}%` }} />
        {Array.from({ length: 51 }, (_, k) => (
          <i key={k} className={k % 5 === 0 ? "major" : ""} style={{ left: `${k * 2}%` }} />
        ))}
        {Array.from({ length: 6 }, (_, k) => (
          <b key={k} style={{ left: `${k * 20}%` }}>
            {k * 20}
          </b>
        ))}
      </div>
      <span className="tape-mark" style={{ left: `${v}%` }} />
    </div>
  );
}

/** Loading state for AI work: Benang watches a needle stitch across a strip of fabric. */
export function SewingLoader() {
  return (
    <div className="sewing" aria-hidden>
      <Mascot size={66} pose="point-right" />
      <div className="sewing-cloth">
        <span className="sewing-stitches" />
        <span className="sewing-needle">
          <Needle />
        </span>
      </div>
    </div>
  );
}
