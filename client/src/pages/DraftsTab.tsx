import { Check, Copy, Mail, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { api, formatDate, type Application, type Draft } from "../api";
import { Busy, ErrorBox, Field, useAction } from "../components/ui";

const KINDS: { key: Draft["kind"]; label: string; hint: string }[] = [
  { key: "email", label: "Email lamaran", hint: "Email pengantar untuk mengirim CV. Dua versi: ringkas dan lebih menjual." },
  { key: "cover_letter", label: "Cover letter", hint: "Surat lamaran 3-4 paragraf untuk portal yang meminta cover letter." },
  { key: "follow_up", label: "Follow-up", hint: "Menanyakan kabar seminggu setelah melamar, dan ucapan terima kasih setelah interview." },
];

export function DraftsTab({ app, hasCv, onApp }: { app: Application; hasCv: boolean; onApp: (a: Application) => void }) {
  const [kind, setKind] = useState<Draft["kind"]>("email");
  const draft = app.drafts?.find((d) => d.kind === kind);
  const [language, setLanguage] = useState(draft?.language ?? (app.cv_language === "Bahasa Indonesia" ? "Bahasa Indonesia" : "English"));
  const [instruction, setInstruction] = useState("");
  const { busy, error, run } = useAction();
  const meta = KINDS.find((k) => k.key === kind)!;

  async function generate() {
    const r = await run(() => api<{ application: Application }>("POST", `/api/applications/${app.id}/drafts`, { kind, language, instruction }));
    if (r) {
      onApp(r.application);
      setInstruction("");
    }
  }

  return (
    <div className="stack-lg">
      <div className="toggles" role="tablist" aria-label="Jenis draft">
        {KINDS.map((k) => (
          <button key={k.key} role="tab" aria-selected={kind === k.key} className={`toggle${kind === k.key ? " on" : ""}`} onClick={() => setKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>

      <div className="card stack">
        <p className="muted">{meta.hint}</p>
        {!hasCv && kind !== "follow_up" && (
          <div className="alert warn">
            <span>CV untuk lowongan ini belum dibuat, jadi draft memakai profil master. Hasilnya lebih tajam kalau CV-nya sudah ada.</span>
          </div>
        )}
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ minWidth: 170 }}>
            <Field label="Bahasa">
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option>English</option>
                <option value="Bahasa Indonesia">Bahasa Indonesia</option>
              </select>
            </Field>
          </div>
          <div className="grow" style={{ minWidth: 240 }}>
            <Field label="Instruksi tambahan (opsional)">
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder='Misalnya "sebut saya siap relokasi" atau "lebih santai"'
              />
            </Field>
          </div>
          {!busy && (
            <button className="btn primary" onClick={generate}>
              {draft ? <RefreshCw size={16} /> : <Sparkles size={16} />} {draft ? "Buat ulang" : "Buat draft"}
            </button>
          )}
        </div>
        <ErrorBox error={error} />
        {busy && <Busy>Menulis draft dari lowongan dan CV-mu</Busy>}
      </div>

      {draft && <DraftView draft={draft} />}
    </div>
  );
}

function DraftView({ draft }: { draft: Draft }) {
  return (
    <div className="stack">
      <div className="card draft-meta">
        <CopyRow label="Kepada" value={draft.to} empty="Tidak disebut di lowongan" />
        <CopyRow label="Subject" value={draft.subject} />
        {draft.notes.length > 0 && (
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
            {draft.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <div className="small muted">
          Dibuat {formatDate(draft.created_at)}, {draft.language}
          {draft.instruction ? `, instruksi: "${draft.instruction}"` : ""}
        </div>
      </div>
      <div className={draft.variants.length > 1 ? "grid-2" : ""}>
        {draft.variants.map((v) => (
          <div key={v.label} className="card stack draft">
            <div className="card-head" style={{ marginBottom: 0 }}>
              <h2>{v.label}</h2>
              <div className="row" style={{ gap: 6 }}>
                <CopyButton text={v.body} />
                <a
                  className="btn sm"
                  href={`mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(v.body)}`}
                >
                  <Mail size={15} /> Buka di email
                </a>
              </div>
            </div>
            <div className="draft-body">{v.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyRow({ label, value, empty }: { label: string; value: string; empty?: string }) {
  return (
    <div className="copy-row">
      <span className="k">{label}</span>
      <span className="v">{value || <span className="muted">{empty}</span>}</span>
      {value && <CopyButton text={value} small />}
    </div>
  );
}

function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }
  return small ? (
    <button className="icon-btn" onClick={copy} aria-label="Salin" title="Salin">
      {done ? <Check size={16} /> : <Copy size={16} />}
    </button>
  ) : (
    <button className="btn sm" onClick={copy}>
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? "Tersalin" : "Salin"}
    </button>
  );
}
