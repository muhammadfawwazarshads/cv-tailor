import { Check, ChevronDown, FileText, PenLine, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, downloadBase64, type FormPlan, type FormSlot, type PersonalData } from "../api";
import { Busy, ErrorBox, useAction } from "../components/ui";
import { PersonalTab } from "./PersonalPage";
import { BenangSays } from "../components/BenangSays";
import { DemoForm } from "../components/TourDemos";
import { FormStory } from "../components/FormStory";

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
  // Two tabs: fill a company form, or review what Benang remembers for forms (its notebook).
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "data" ? "data" : "fill";
  const goTab = (t: "fill" | "data") => setParams(t === "data" ? { tab: "data" } : {}, { replace: true });

  useEffect(() => {
    api<PersonalData>("GET", "/api/personal").then(setPersonal, () => {});
  }, [tab]);

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

  const head = (
    <>
      <div className="page-head">
        <div>
          <h1>Form HR</h1>
          <p>
            Form data diri dari perusahaan (.docx) diisi Benang dari Bahan CV dan buku catatannya. Yang belum dia tahu ditanyakan sekali, dicatat, lalu
            terisi sendiri di form berikutnya.
          </p>
        </div>
      </div>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={tab === "fill"} className={tab === "fill" ? "active" : ""} onClick={() => goTab("fill")}>
          Isi form
        </button>
        <button role="tab" aria-selected={tab === "data"} className={tab === "data" ? "active" : ""} onClick={() => goTab("data")}>
          Buku catatan Benang {personal && personal.personal.items.length > 0 && <span className="n">{personal.personal.items.length}</span>}
        </button>
      </div>
    </>
  );

  if (tab === "data") {
    return (
      <>
        {head}
        <PersonalTab />
      </>
    );
  }

  return (
    <>
      {head}

      {personal && !personal.signature && (file || analysis) && (
        <div className="alert warn" style={{ marginBottom: 16 }}>
          <span>
            Tanda tangan belum ada.{" "}
            <a
              href="?tab=data"
              onClick={(e) => {
                e.preventDefault();
                goTab("data");
              }}
            >
              Simpan tanda tanganmu di buku catatan Benang
            </a>{" "}
            dulu supaya ikut ditempel.
          </span>
        </div>
      )}

      {!file && !analysis && <FormsIntro personal={personal} onData={() => goTab("data")} />}

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

      {analysis && file && (
        <div className="stack-lg">
          <FormStory
            key={`${file.name}-${file.lastModified}`}
            analysis={analysis}
            fileName={file.name}
            answers={answers}
            setAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
            remember={remember}
            setRemember={setRemember}
            hasSignature={Boolean(personal?.signature)}
            busy={fill.busy}
            done={done}
            onDownload={download}
            onNotebook={() => goTab("data")}
          />
          <ErrorBox error={fill.error} />

          <AutoFilled analysis={analysis} labelOf={labelOf} overrides={overrides} setOverrides={setOverrides} />

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
          <h2>Periksa isian otomatis ({total})</h2>
          <p className="muted small">Dari Bahan CV, buku catatan Benang, dan tanggal hari ini. Buka untuk memeriksa atau mengubah.</p>
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

/** Before a form is chosen: what Benang does with it, a preview, and how ready the saved data is. */
function FormsIntro({ personal, onData }: { personal: PersonalData | null; onData: () => void }) {
  const items = personal?.personal.items.length ?? 0;
  const ready = [
    { label: items ? `${items} catatan di buku Benang` : "Buku catatan Benang masih kosong", ok: items > 0 },
    { label: personal?.signature ? "Tanda tangan siap" : "Tanda tangan belum ada", ok: Boolean(personal?.signature) },
    { label: personal?.photo ? "Pas foto siap" : "Pas foto belum ada", ok: Boolean(personal?.photo) },
  ];
  const missing = ready.filter((r) => !r.ok).length;
  return (
    <section className="forms-intro" data-tour="forms">
      <div className="stack">
        <BenangSays pose={missing ? "point-right" : "cheer"}>
          <b>Dapat form data diri dari HR?</b>
          <p>Unggah .docx-nya di bawah. Benang mengisi yang sudah dia tahu dari Bahan CV dan buku catatannya, menanyakan sisanya, lalu mencatatnya untuk form berikutnya.</p>
        </BenangSays>
        <ul className="ready-list">
          {ready.map((r) => (
            <li key={r.label} className={r.ok ? "ok" : ""}>
              {r.ok ? <Check size={13} /> : <X size={13} />} {r.label}
            </li>
          ))}
        </ul>
        {missing > 0 && (
          <button className="btn sm" type="button" onClick={onData} style={{ alignSelf: "flex-start" }}>
            Buka buku catatan Benang
          </button>
        )}
      </div>
      <div className="forms-preview" aria-hidden>
        <DemoForm />
      </div>
    </section>
  );
}
