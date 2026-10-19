import { ArrowLeft, Check, Download, ExternalLink, FileCode2, ListChecks, MessageSquareQuote, Minus, PenLine, Scissors, ShieldOff, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatDate, STANDALONE, STATUS_LABELS, type Application, type CvDocument, type Version } from "../api";
import { CvPreview } from "../components/CvPreview";
import { SewTrack, sewProgress, TapeMeasure } from "../components/Sewing";
import { DraftsTab } from "./DraftsTab";
import { Busy, ErrorBox, Loading, useAction } from "../components/ui";

type Tab = "analysis" | "cv" | "email" | "jd";

const QUICK_REPLIES = ["Belum pernah", "Baru belajar, belum di project", "Pernah di project pribadi", "Pernah di kerjaan, saya yang setup"];

export function ApplicationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [tab, setTab] = useState<Tab>("analysis");
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const load = useAction();

  async function refresh(selectVersion?: string) {
    const r = await api<{ application: Application; versions: Version[] }>("GET", `/api/applications/${id}`);
    setApp(r.application);
    setVersions(r.versions);
    if (selectVersion) setActiveVersion(selectVersion);
    else if (!activeVersion && r.versions[0]) setActiveVersion(r.versions[0].id);
    return r;
  }

  useEffect(() => {
    load.run(async () => {
      const r = await refresh();
      setTab(r.versions.length ? "cv" : "analysis");
    });
  }, [id]);

  if (!app) {
    return load.error ? (
      <div className="stack">
        <ErrorBox error={load.error} />
        <Link to="/applications">Kembali ke daftar lamaran</Link>
      </div>
    ) : (
      <Loading />
    );
  }

  async function setStatus(status: string) {
    const r = await api<{ application: Application }>("PATCH", `/api/applications/${app!.id}`, { status });
    setApp(r.application);
  }

  async function remove() {
    if (!confirm("Hapus lamaran ini beserta semua versi CV-nya?")) return;
    await api("DELETE", `/api/applications/${app!.id}`);
    navigate("/applications");
  }

  return (
    <>
      <Link to="/applications" className="crumb">
        <ArrowLeft size={15} /> Semua lamaran
      </Link>
      <div className="page-head">
        <div>
          <h1>{app.role_title || "Posisi tanpa judul"}</h1>
          <p>
            {app.company || "Perusahaan belum diisi"}, CV dalam {app.cv_language}, dibuat {formatDate(app.created_at)}
          </p>
        </div>
        <div className="row">
          <select value={app.status} onChange={(e) => setStatus(e.target.value)} aria-label="Status lamaran" style={{ width: "auto", background: "var(--surface)" }}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="icon-btn" onClick={remove} aria-label="Hapus lamaran" title="Hapus lamaran">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="sew-head">
        <SewTrack
          done={sewProgress({ measured: Boolean(app.analysis), status: app.status, versions: versions.length })}
          onStep={(i) => setTab(i < 2 ? "analysis" : i === 2 ? "cv" : "email")}
        />
      </div>

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={tab === "analysis"} className={tab === "analysis" ? "active" : ""} onClick={() => setTab("analysis")}>
          Kecocokan
        </button>
        <button role="tab" aria-selected={tab === "cv"} className={tab === "cv" ? "active" : ""} onClick={() => setTab("cv")}>
          CV {versions.length > 0 && <span className="n">{versions.length}</span>}
        </button>
        <button role="tab" aria-selected={tab === "email"} className={tab === "email" ? "active" : ""} onClick={() => setTab("email")}>
          Email {(app.drafts?.length ?? 0) > 0 && <span className="n">{app.drafts!.length}</span>}
        </button>
        <button role="tab" aria-selected={tab === "jd"} className={tab === "jd" ? "active" : ""} onClick={() => setTab("jd")}>
          Lowongan
        </button>
      </div>

      {tab === "analysis" && (
        <AnalysisTab
          app={app}
          onApp={setApp}
          onTailored={async (vid) => {
            await refresh(vid);
            setTab("cv");
          }}
        />
      )}
      {tab === "cv" && (
        <CvTab
          app={app}
          versions={versions}
          activeId={activeVersion}
          onSelect={setActiveVersion}
          onNewVersion={(vid) => refresh(vid)}
          onGoAnalysis={() => setTab("analysis")}
        />
      )}
      {tab === "email" && <DraftsTab app={app} hasCv={versions.length > 0} onApp={setApp} />}
      {tab === "jd" && (
        <div className="card">
          <div style={{ whiteSpace: "pre-wrap", maxWidth: "80ch" }}>{app.job_description}</div>
        </div>
      )}
    </>
  );
}

/* ---------------- Fit + confirmation questions ---------------- */

function AnalysisTab({ app, onApp, onTailored }: { app: Application; onApp: (a: Application) => void; onTailored: (vid: string) => void }) {
  const a = app.analysis;
  const answered = useMemo(() => new Map(app.answers.map((x) => [x.questionId, x.answer])), [app.answers]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [asFact, setAsFact] = useState<Record<string, boolean>>({});
  const act = useAction();
  const [busyLabel, setBusyLabel] = useState("");

  useEffect(() => {
    setDraft(Object.fromEntries((a?.questions ?? []).map((q) => [q.id, answered.get(q.id) ?? ""])));
  }, [a]);

  async function saveAnswers() {
    const answers = (a?.questions ?? [])
      .filter((q) => (draft[q.id] ?? "") !== (answered.get(q.id) ?? ""))
      .map((q) => ({ questionId: q.id, question: q.question, answer: draft[q.id] ?? "", saveAsFact: asFact[q.id] ?? true }));
    if (!answers.length) return app;
    const r = await api<{ application: Application }>("POST", `/api/applications/${app.id}/answers`, { answers });
    onApp(r.application);
    return r.application;
  }

  const go = (label: string, fn: () => Promise<void>) => {
    setBusyLabel(label);
    act.run(fn);
  };

  if (!a) {
    return (
      <div className="card stack">
        {app.error ? <ErrorBox error={`Analisis gagal. ${app.error}`} /> : <p className="muted">Analisis belum tersedia.</p>}
        {act.busy ? (
          <Busy>Menilai ulang kecocokan</Busy>
        ) : (
          <div>
            <button
              className="btn primary"
              onClick={() =>
                go("", async () => {
                  const r = await api<{ application: Application }>("POST", `/api/applications/${app.id}/analyze`);
                  onApp(r.application);
                })
              }
            >
              Nilai ulang kecocokan
            </button>
          </div>
        )}
        <ErrorBox error={act.error} />
      </div>
    );
  }

  const filled = a.questions.filter((q) => (draft[q.id] ?? "").trim()).length;
  const prevAnswers = app.answers.filter((x) => !a.questions.some((q) => q.id === x.questionId));

  return (
    <div className="stack-lg">
      <section className="fit-hero" aria-label="Skor kecocokan">
        <div>
          <div className="fit-num">
            <b>{a.fitScore}</b>
            <span>%</span>
          </div>
          <TapeMeasure value={a.fitScore} />
        </div>
        <div>
          <h2>{a.verdict}</h2>
          <p>{a.summary}</p>
          {a.focus.length > 0 && (
            <div className="chips">
              {a.focus.map((f, i) => (
                <span className="chip" key={i}>
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Yang sudah cocok</h2>
            <span className="chip fit">{a.strengths.length}</span>
          </div>
          <ul className="evidence">
            {a.strengths.map((s, i) => (
              <li key={i}>
                <span className="mark fit">
                  <Check size={14} strokeWidth={3} />
                </span>
                <div>
                  <b>{s.point}</b>
                  {s.evidence && <div className="note">{s.evidence}</div>}
                </div>
              </li>
            ))}
            {!a.strengths.length && <li className="muted">Belum ada yang cocok jelas.</li>}
          </ul>
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Gap yang perlu disiapkan</h2>
            <span className="chip gap">{a.gaps.length}</span>
          </div>
          <ul className="evidence">
            {a.gaps.map((g, i) => (
              <li key={i}>
                <span className="mark gap">
                  <Minus size={14} strokeWidth={3} />
                </span>
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <b>{g.point}</b>
                    {g.severity === "high" && <span className="chip bad">syarat penting</span>}
                  </div>
                  {g.advice && <div className="note">{g.advice}</div>}
                </div>
              </li>
            ))}
            {!a.gaps.length && <li className="muted">Tidak ada gap besar.</li>}
          </ul>
        </div>
      </div>

      <div className="card stack-lg">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2>Beberapa hal yang perlu dipastikan</h2>
            <p>Jawab singkat. Jawaban "belum pernah" sama pentingnya, karena hal itu tidak akan diklaim di CV.</p>
          </div>
          {a.questions.length > 0 && (
            <span className="chip blue">
              {filled} dari {a.questions.length} terjawab
            </span>
          )}
        </div>
        {a.questions.length === 0 && <p className="muted">Bahan CV-mu sudah cukup jelas untuk lowongan ini. Langsung jahit CV-nya.</p>}
        <div className="qa">
          {a.questions.map((q) => {
            const val = draft[q.id] ?? "";
            return (
              <div className="qa-item" key={q.id}>
                <div className="bubble-q">
                  <b>{q.question}</b>
                  {q.reason && <div className="why">{q.reason}</div>}
                </div>
                <div className={`answer${val.trim() ? " filled" : ""}`}>
                  <textarea
                    rows={2}
                    aria-label={`Jawaban: ${q.question}`}
                    value={val}
                    onChange={(e) => setDraft({ ...draft, [q.id]: e.target.value })}
                    placeholder="Tulis jawabanmu atau pilih di bawah"
                  />
                  {!val.trim() && (
                    <div className="quick">
                      {QUICK_REPLIES.map((r) => (
                        <button key={r} type="button" onClick={() => setDraft({ ...draft, [q.id]: r })}>
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="check">
                    <input type="checkbox" checked={asFact[q.id] ?? true} onChange={(e) => setAsFact({ ...asFact, [q.id]: e.target.checked })} />
                    Ingat untuk lamaran lain
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        {prevAnswers.length > 0 && (
          <details>
            <summary className="small muted" style={{ cursor: "pointer" }}>
              Jawaban dari putaran sebelumnya ({prevAnswers.length})
            </summary>
            <ul className="small" style={{ marginTop: 8 }}>
              {prevAnswers.map((x) => (
                <li key={x.questionId}>
                  <b>{x.question}</b> {x.answer}
                </li>
              ))}
            </ul>
          </details>
        )}
        <ErrorBox error={act.error} />
        {act.busy ? (
          <Busy>{busyLabel}</Busy>
        ) : (
          <div className="sticky-actions">
            <button
              className="btn primary"
              onClick={() =>
                go("Menulis CV untuk lowongan ini", async () => {
                  await saveAnswers();
                  const r = await api<{ version: Version }>("POST", `/api/applications/${app.id}/tailor`);
                  onTailored(r.version.id);
                })
              }
            >
              <Scissors size={17} /> Buat CV
            </button>
            <button
              className="btn"
              onClick={() =>
                go("Menilai ulang dengan jawabanmu", async () => {
                  await saveAnswers();
                  const r = await api<{ application: Application }>("POST", `/api/applications/${app.id}/analyze`);
                  onApp(r.application);
                })
              }
            >
              Nilai ulang
            </button>
            <button className="btn ghost" onClick={() => go("Menyimpan jawaban", async () => void (await saveAnswers()))}>
              Simpan jawaban
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- CV versions ---------------- */

function CvTab({
  app,
  versions,
  activeId,
  onSelect,
  onNewVersion,
  onGoAnalysis,
}: {
  app: Application;
  versions: Version[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewVersion: (id: string) => Promise<unknown>;
  onGoAnalysis: () => void;
}) {
  const v = versions.find((x) => x.id === activeId) ?? versions[0];
  const [instruction, setInstruction] = useState("");
  const [saveFact, setSaveFact] = useState(false);
  const [editing, setEditing] = useState(false);
  const [json, setJson] = useState("");
  const act = useAction();
  const [busyLabel, setBusyLabel] = useState("");

  if (!v) {
    return (
      <div className="card empty">
        <h2>Belum ada CV untuk lowongan ini</h2>
        <p>Jawab pertanyaan di tab Kecocokan, lalu tekan Buat CV.</p>
        <button className="btn primary" onClick={onGoAnalysis}>
          Buka tab Kecocokan
        </button>
      </div>
    );
  }

  const pdfUrl = `/api/applications/${app.id}/versions/${v.id}/pdf`;
  const go = (label: string, fn: () => Promise<void>) => {
    setBusyLabel(label);
    act.run(fn);
  };

  return (
    <div className="cv-layout">
      <div>
        {editing ? (
          <div className="card stack">
            <div className="card-head" style={{ marginBottom: 0 }}>
              <div>
                <h2>Edit manual</h2>
                <p>Ubah teks langsung di JSON. Hasilnya disimpan sebagai versi baru.</p>
              </div>
            </div>
            <textarea className="mono" rows={30} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
            <ErrorBox error={act.error} />
            <div className="row">
              <button
                className="btn primary"
                disabled={act.busy}
                onClick={() =>
                  go("Menyimpan", async () => {
                    let cv: CvDocument;
                    try {
                      cv = JSON.parse(json);
                    } catch {
                      throw new Error("JSON tidak valid. Periksa tanda kutip dan koma.");
                    }
                    const r = await api<{ version: Version }>("PUT", `/api/applications/${app.id}/versions/${v.id}`, { cv });
                    await onNewVersion(r.version.id);
                    setEditing(false);
                  })
                }
              >
                Simpan sebagai versi baru
              </button>
              <button className="btn ghost" onClick={() => setEditing(false)}>
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="desk">
            <CvPreview cv={v.data} />
          </div>
        )}
      </div>

      <aside className="side-panel">
        <div className="card stack">
          {STANDALONE ? (
            <>
              <button className="btn dark block" onClick={() => printCv(v.data, app.company)} disabled={editing}>
                <Download size={17} /> Unduh PDF
              </button>
              <p className="small muted">Pilih "Save as PDF" atau "Simpan sebagai PDF" di jendela cetak, ukuran kertas A4.</p>
            </>
          ) : (
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <a className="btn dark grow" href={pdfUrl}>
                <Download size={17} /> Unduh PDF
              </a>
              <a className="btn" href={`${pdfUrl}?inline=1`} target="_blank" rel="noreferrer" aria-label="Buka PDF di tab baru" title="Buka PDF di tab baru">
                <ExternalLink size={17} />
              </a>
            </div>
          )}
          {!editing && (
            <button
              className="btn ghost sm"
              onClick={() => {
                setJson(JSON.stringify(v.data, null, 2));
                setEditing(true);
              }}
            >
              <FileCode2 size={15} /> Edit manual
            </button>
          )}
        </div>

        <div className="card composer-mini">
          <h2 className="row" style={{ gap: 8 }}>
            <PenLine size={18} /> Minta perubahan
          </h2>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            aria-label="Instruksi revisi"
            placeholder="Contoh: ganti jadi Technology Consultant. Hapus Kubernetes, saya belum pernah. Ringkas bullet EY jadi 4."
          />
          <label className="check">
            <input type="checkbox" checked={saveFact} onChange={(e) => setSaveFact(e.target.checked)} />
            Ingat isi instruksi ini sebagai fakta tentang saya
          </label>
          <ErrorBox error={!editing ? act.error : null} />
          {act.busy && !editing ? (
            <Busy>{busyLabel}</Busy>
          ) : (
            <button
              className="btn primary"
              disabled={instruction.trim().length < 3}
              onClick={() =>
                go("Merevisi CV", async () => {
                  const r = await api<{ version: Version }>("POST", `/api/applications/${app.id}/versions/${v.id}/revise`, { instruction, saveAsFact: saveFact });
                  setInstruction("");
                  setSaveFact(false);
                  await onNewVersion(r.version.id);
                })
              }
            >
              Terapkan
            </button>
          )}
        </div>

        <div className="card notes stack">
          <Notes icon={<ListChecks size={17} />} title="Yang diubah" items={v.notes.changes} />
          <Notes icon={<ShieldOff size={17} />} title="Sengaja tidak diklaim" items={v.notes.notClaimed} />
          <Notes icon={<MessageSquareQuote size={17} />} title="Kemungkinan ditanya saat interview" items={v.notes.interviewPrep} />
        </div>

        <div className="card">
          <div className="card-head" style={{ marginBottom: 8 }}>
            <h2>Riwayat versi</h2>
          </div>
          <div className="versions">
            {versions.map((x) => (
              <button key={x.id} className={x.id === v.id ? "active" : ""} onClick={() => onSelect(x.id)} title={x.label}>
                <span className="v">v{x.number}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="label">{x.label}</span>
                  <span className="when">{formatDate(x.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Opens the browser print dialog with only the CV visible; the file name comes from the page title. */
function printCv(cv: CvDocument, company: string) {
  const prev = document.title;
  document.title = ["CV", cv.name, company].filter(Boolean).join("_").replace(/[^\p{L}\p{N}_]+/gu, "_");
  const restore = () => {
    document.title = prev;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

function Notes({ icon, title, items }: { icon: React.ReactNode; title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section>
      <h3>
        {icon}
        {title}
      </h3>
      <ul>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </section>
  );
}
