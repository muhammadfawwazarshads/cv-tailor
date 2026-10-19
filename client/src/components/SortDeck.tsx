import { Check, Flag, Minus, RotateCcw, Scissors, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type LeadRow } from "../api";
import { Mascot, type MascotPose } from "./Mascot";

/**
 * "Pilah bareng Benang": new jobs one at a time as fabric swatches. Swipe (or press →) to keep one for
 * sewing (status "saved"), swipe left (←) to set it aside ("dismissed"); Backspace undoes. Keeping a
 * job costs no AI call: it only lands in the Disimpan tab, ready to become an application.
 */
type Decision = { lead: LeadRow; status: "saved" | "dismissed" };

const REC_LABEL: Record<string, string> = { apply: "Layak daftar", try: "Coba aja", skip: "Lewati" };
const THRESHOLD = 110;

function coverage(d: LeadRow["data"]) {
  const total = d.matched.length + d.missing.length;
  return total ? `${d.matched.length} dari ${total} syarat ada di bahanmu` : `cocok ${d.fitScore}%`;
}

/** What Benang thinks of a job, in one line. */
function opinion(l: LeadRow) {
  const d = l.data;
  if (d.redFlags.length) return `Hati-hati, ada tanda bahaya: ${d.redFlags[0].replace(/\.$/, "")}.`;
  if (d.recommendation === "apply") return `${coverage(d)}. Ini layak banget dijahit.`;
  if (d.recommendation === "try") return `${coverage(d)}. Boleh dicoba kalau kamu tertarik.`;
  return `${coverage(d)}. Menurutku lewati saja.`;
}

export function SortDeck({ leads, onDecided, onClose, onShowSaved }: { leads: LeadRow[]; onDecided: (lead: LeadRow) => void; onClose: () => void; onShowSaved: () => void }) {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Decision[]>([]);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"saved" | "dismissed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const lead = leads[index];
  const done = !lead;

  async function decide(status: "saved" | "dismissed") {
    if (!lead || leaving) return;
    setLeaving(status);
    setTimeout(async () => {
      setLeaving(null);
      setDx(0);
      setIndex((i) => i + 1);
      setHistory((h) => [...h, { lead, status }]);
      try {
        const r = await api<{ lead: LeadRow }>("PATCH", `/api/leads/${lead.id}`, { status });
        onDecided(r.lead);
        setError(null);
      } catch (e: any) {
        setError(`Gagal menyimpan pilihan: ${e?.message ?? e}`);
      }
    }, 260);
  }

  async function undo() {
    const last = history[history.length - 1];
    if (!last || leaving) return;
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    try {
      const r = await api<{ lead: LeadRow }>("PATCH", `/api/leads/${last.lead.id}`, { status: "new" });
      onDecided(r.lead);
    } catch (e: any) {
      setError(`Gagal membatalkan: ${e?.message ?? e}`);
    }
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decide("saved");
      else if (e.key === "ArrowLeft") decide("dismissed");
      else if (e.key === "Backspace") undo();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const kept = history.filter((h) => h.status === "saved").length;
  const pose: MascotPose = done ? "cheer" : dx > 40 ? "point-right" : dx < -40 ? "point-left" : lead.data.redFlags.length ? "sad" : lead.data.recommendation === "apply" ? "wave" : "idle";
  const said = done
    ? kept
      ? `Beres! ${kept} lowongan masuk rak, siap dijahit jadi lamaran.`
      : "Beres! Tidak ada yang disimpan kali ini."
    : dx > 40
      ? "Simpan buat dijahit!"
      : dx < -40
        ? "Lewati yang ini?"
        : opinion(lead);
  const pull = Math.min(1, Math.abs(dx) / THRESHOLD);

  return (
    <div className="deck" role="dialog" aria-modal="true" aria-label="Pilah lowongan bareng Benang">
      <div className="deck-top">
        <span className="deck-count">{done ? `${leads.length} dipilah` : `${index + 1} dari ${leads.length}`}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
      </div>

      <div className="deck-benang">
        <Mascot size={96} pose={pose} />
        <div className="deck-says" key={said}>
          {said}
        </div>
      </div>

      {done ? (
        <div className="deck-done">
          <div className="deck-tally">
            <span>
              <b>{kept}</b> disimpan
            </span>
            <span>
              <b>{history.length - kept}</b> dilewati
            </span>
          </div>
          <div className="row" style={{ justifyContent: "center" }}>
            {kept > 0 && (
              <button className="btn primary" onClick={onShowSaved}>
                Buka yang disimpan
              </button>
            )}
            <button className="btn ghost" onClick={onClose}>
              Selesai
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="deck-stack">
            {leads.slice(index + 1, index + 3).map((l, k) => (
              <div key={l.id} className="swatch behind" style={{ transform: `translateY(${(k + 1) * 10}px) scale(${1 - (k + 1) * 0.04})`, zIndex: 2 - k }} aria-hidden>
                <div className="swatch-seam" />
              </div>
            ))}
            <article
              key={lead.id}
              className={`swatch top${leaving ? ` out-${leaving}` : ""}${drag.current ? " dragging" : ""}`}
              style={leaving ? undefined : { transform: `translateX(${dx}px) rotate(${dx / 18}deg)` }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button, a")) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, id: e.pointerId };
              }}
              onPointerMove={(e) => drag.current && setDx(e.clientX - drag.current.x)}
              onPointerUp={() => {
                drag.current = null;
                if (dx > THRESHOLD) decide("saved");
                else if (dx < -THRESHOLD) decide("dismissed");
                else setDx(0);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setDx(0);
              }}
            >
              <div className="swatch-seam" />
              <span className="swatch-stamp keep" style={{ opacity: dx > 0 ? pull : 0 }}>
                Jahit
              </span>
              <span className="swatch-stamp pass" style={{ opacity: dx < 0 ? pull : 0 }}>
                Lewati
              </span>

              <div className={`swatch-verdict ${lead.data.recommendation}`}>
                <b>{REC_LABEL[lead.data.recommendation]}</b>
                <span>{coverage(lead.data)}</span>
              </div>
              <h2>{lead.title}</h2>
              <p className="swatch-co">
                {lead.company || "Perusahaan tidak disebut"}
                {lead.data.location && ` · ${lead.data.location}`}
              </p>
              {lead.data.redFlags.length > 0 && (
                <ul className="swatch-flags">
                  {lead.data.redFlags.slice(0, 2).map((f) => (
                    <li key={f}>
                      <Flag size={12} /> {f}
                    </li>
                  ))}
                </ul>
              )}
              <div className="swatch-cols">
                {lead.data.matched.length > 0 && (
                  <ul>
                    {lead.data.matched.slice(0, 4).map((m) => (
                      <li key={m} className="have">
                        <Check size={12} /> {m}
                      </li>
                    ))}
                  </ul>
                )}
                {lead.data.missing.length > 0 && (
                  <ul>
                    {lead.data.missing.slice(0, 4).map((m) => (
                      <li key={m} className="lack">
                        <Minus size={12} /> {m}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {lead.data.companyNote && <p className="swatch-note">{lead.data.companyNote}</p>}
            </article>
          </div>

          <div className="deck-actions">
            <button className="deck-btn pass" onClick={() => decide("dismissed")} aria-label="Lewati">
              <X size={22} />
            </button>
            <button className="deck-btn undo" onClick={undo} disabled={!history.length} aria-label="Batalkan pilihan terakhir">
              <RotateCcw size={16} />
            </button>
            <button className="deck-btn keep" onClick={() => decide("saved")} aria-label="Simpan buat dijahit">
              <Scissors size={22} />
            </button>
          </div>
          <p className="deck-hint">Geser kanan atau → untuk simpan buat dijahit, kiri atau ← untuk lewati</p>
        </>
      )}
      {error && <p className="deck-error">{error}</p>}
    </div>
  );
}
