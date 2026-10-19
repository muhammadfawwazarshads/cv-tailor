import { Check, ChevronDown, Download, FileText, PenLine, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, downloadBase64, type FormPlan, type FormQuestion, type FormSlot, type PersonalData } from "../api";
import { Busy, ErrorBox, useAction } from "../components/ui";

type Analysis = { slots: FormSlot[]; plan: FormPlan };
type AnswerMap = Record<string, string | string[]>;

/** Turns the AI plan plus the user's answers into what the filler writes. */
function buildFill(a: Analysis, overrides: Record<string, string>, answers: AnswerMap) {
  const kind = new Map(a.slots.map((s) => [s.id, s.kind]));
  const values: Record<string, string> = Object.fromEntries(a.plan.values.map((v) => [v.id, v.value]));
  Object.assign(values, overrides);
  const checks = new Set(a.plan.checks);
  const replacements = [...a.plan.replacements];
  for (const q of a.plan.questions) {
    const ans = answers[q.id];
    const list = (Array.isArray(ans) ? ans : [ans ?? ""]).map((x) => x.trim()).filter(Boolean);
    if (!list.length) continue;
    const text = list.join(", ");
    if (q.find) replacements.push({ find: q.find, replace: q.template ? q.template.split("{answer}").join(text) : text });
    else if (q.options.length > 1 && q.slotIds.length === q.options.length) {
      for (const choice of list) {
        const id = q.slotIds[q.options.indexOf(choice)];
        if (!id) continue;
        if (kind.get(id) === "check") checks.add(id);
        else values[id] = "✓";
      }
    } else if (q.slotIds[0]) values[q.slotIds[0]] = text;
  }
  return { values, checks: [...checks], replacements };
}

export function FormsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(true);
  const [personal, setPersonal] = useState<PersonalData | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const read = useAction();
  const fill = useAction();

  useEffect(() => {
    api<PersonalData>("GET", "/api/personal").then(setPersonal, () => {});
  }, []);

  async function analyze(f: File) {
    setFile(f);
    setAnalysis(null);
    setAnswers({});
    setOverrides({});
    setDone(null);
    const fd = new FormData();
    fd.append("file", f);
    const r = await read.run(() => api<Analysis>("POST", "/api/forms/analyze", fd));
    if (r) setAnalysis(r);
  }

  async function download() {
    if (!file || !analysis) return;
    const r = await fill.run(async () => {
      if (remember) {
        const learned = analysis.plan.questions
          .filter((q) => q.saveAs && answers[q.id] && String(answers[q.id]).trim())
          .map((q) => ({ label: q.saveAs, value: Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).join(", ") : String(answers[q.id]).trim() }));
        if (learned.length) {
          const current = (await api<PersonalData>("GET", "/api/personal")).personal.items;
          const merged = [...current.filter((i) => !learned.some((l) => l.label.toLowerCase() === i.label.toLowerCase())), ...learned];
          await api("PUT", "/api/personal", { personal: { items: merged } });
        }
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("fill", JSON.stringify(buildFill(analysis, overrides, answers)));
      return api<{ file: string; filename: string; filled: number }>("POST", "/api/forms/fill", fd);
    });
    if (r) {
      downloadBase64(r.file, r.filename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      setDone(`${r.filled} isian ditulis ke ${r.filename}.`);
    }
  }

  const labelOf = useMemo(() => new Map(analysis?.slots.map((s) => [s.id, s.label]) ?? []), [analysis]);
  const answered = analysis ? analysis.plan.questions.filter((q) => [answers[q.id]].flat().some((x) => x && String(x).trim())).length : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Isi form</h1>
          <p>
            Unggah form data diri dari perusahaan (.docx). Yang sudah diketahui diisi otomatis dari profil dan jawaban tersimpan, sisanya ditanyakan
            di sini. Hasilnya .docx terisi lengkap dengan tanda tangan.
          </p>
        </div>
      </div>

      {personal && !personal.signature && (
        <div className="alert warn" style={{ marginBottom: 16 }}>
          <span>
            Tanda tangan belum ada. <Link to="/personal">Simpan tanda tanganmu</Link> dulu supaya ikut ditempel.
          </span>
        </div>
      )}

      <label className="file-drop" style={{ marginBottom: 18 }}>
        <Upload size={20} />
        <div>
          <b>{file ? file.name : "Pilih file form .docx"}</b>
          <div className="small muted">Form .doc atau PDF: buka di Word atau Google Docs, lalu simpan sebagai .docx.</div>
        </div>
        <input type="file" accept=".docx" onChange={(e) => e.target.files?.[0] && analyze(e.target.files[0])} />
      </label>
      <ErrorBox error={read.error} />
      {read.busy && <Busy>Membaca form dan mencocokkan dengan datamu</Busy>}

      {analysis && (
        <div className="stack-lg">
          <AutoFilled analysis={analysis} labelOf={labelOf} overrides={overrides} setOverrides={setOverrides} />

          {analysis.plan.questions.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Yang perlu kamu jawab</h2>
                  <p>
                    {answered} dari {analysis.plan.questions.length} terjawab. Yang dikosongkan akan dibiarkan kosong di form.
                  </p>
                </div>
              </div>
              <div className="qa">
                {analysis.plan.questions.map((q) => (
                  <QuestionItem key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
                ))}
              </div>
            </div>
          )}

          {(analysis.plan.skipped.length > 0 || analysis.plan.notes.length > 0) && (
            <div className="card notes">
              {analysis.plan.notes.length > 0 && (
                <section>
                  <h3>Catatan</h3>
                  <ul>
                    {analysis.plan.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </section>
              )}
              {analysis.plan.skipped.length > 0 && (
                <section>
                  <h3>Sengaja tidak diisi</h3>
                  <ul>
                    {analysis.plan.skipped.map((s) => (
                      <li key={s.label}>
                        <b>{s.label}</b>
                        {s.reason ? `: ${s.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          <div className="sticky-actions">
            <label className="check" style={{ padding: "0 8px" }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Simpan jawaban untuk form berikutnya
            </label>
            {fill.busy ? (
              <Busy>Mengisi form</Busy>
            ) : (
              <button className="btn primary" onClick={download}>
                <Download size={17} /> Isi &amp; unduh .docx
              </button>
            )}
          </div>
          <ErrorBox error={fill.error} />
          {done && (
            <div className="alert ok">
              <Check size={17} style={{ marginTop: 1 }} />
              <span>{done} Buka di Word atau Google Docs, periksa sekali lagi (terutama kotak centang bergambar dan tata letak), lalu simpan sebagai PDF bila diminta.</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AutoFilled({
  analysis,
  labelOf,
  overrides,
  setOverrides,
}: {
  analysis: Analysis;
  labelOf: Map<string, string>;
  overrides: Record<string, string>;
  setOverrides: (o: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const values = analysis.plan.values.filter((v) => v.value.trim());
  const total = values.length + analysis.plan.checks.length + analysis.plan.replacements.length;
  return (
    <div className="card">
      <button className="disclosure" onClick={() => setOpen(!open)} aria-expanded={open}>
        <FileText size={18} />
        <div style={{ flex: 1, textAlign: "left" }}>
          <h2>Diisi otomatis: {total} isian</h2>
          <p className="muted small">Dari profil CV, jawaban tersimpan, dan tanggal hari ini. Buka untuk memeriksa atau mengubah.</p>
        </div>
        <ChevronDown size={18} className="chev" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <div className="kv" style={{ marginTop: 14 }}>
          {values.map((v) => (
            <div className="kv-row" key={v.id}>
              <span className="kv-label">{labelOf.get(v.id) ?? v.id}</span>
              {v.value.startsWith("[[") ? (
                <span className="chip blue">
                  <PenLine size={13} /> {v.value === "[[SIGNATURE]]" ? "Tanda tangan" : "Pas foto"}
                </span>
              ) : (
                <textarea rows={1} aria-label={labelOf.get(v.id) ?? v.id} value={overrides[v.id] ?? v.value} onChange={(e) => setOverrides({ ...overrides, [v.id]: e.target.value })} />
              )}
              <span />
            </div>
          ))}
          {analysis.plan.checks.map((id) => (
            <div className="kv-row" key={id}>
              <span className="kv-label">{labelOf.get(id) ?? id}</span>
              <span className="chip fit">
                <Check size={13} /> dicentang
              </span>
              <span />
            </div>
          ))}
          {analysis.plan.replacements.map((r) => (
            <div className="kv-row" key={r.find}>
              <span className="kv-label">{r.find}</span>
              <span>{r.replace}</span>
              <span />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionItem({ q, value, onChange }: { q: FormQuestion; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="qa-item">
      <div className="bubble-q">
        <b>{q.question}</b>
        {q.why && <div className="why">{q.why}</div>}
      </div>
      <div className={`answer${selected.length ? " filled" : ""}`}>
        {q.options.length > 0 ? (
          <div className="quick" role="group" aria-label={q.question}>
            {q.options.map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={on}
                  className={on ? "on" : ""}
                  onClick={() => onChange(q.multi ? (on ? selected.filter((x) => x !== o) : [...selected, o]) : on ? "" : o)}
                >
                  {on && <Check size={13} />} {o}
                </button>
              );
            })}
          </div>
        ) : (
          <textarea aria-label={q.question} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} placeholder="Jawabanmu" />
        )}
      </div>
    </div>
  );
}
