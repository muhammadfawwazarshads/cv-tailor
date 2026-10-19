import { Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatDate, STATUS_LABELS, STATUS_TONE, type Application, type ApplicationSummary } from "../api";
import { Busy, ErrorBox, Field, Loading, Modal, useAction } from "../components/ui";

export function FitBar({ score }: { score: number | null }) {
  if (score == null) return <span className="muted small">Belum dinilai</span>;
  return (
    <div className={`fitbar${score >= 70 ? " high" : ""}`} title={`Kecocokan ${score}%`}>
      <div className="track">
        <i style={{ width: `${score}%` }} />
      </div>
      {score}%
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip dot ${STATUS_TONE[status] ?? ""}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function ApplicationsPage() {
  const [apps, setApps] = useState<ApplicationSummary[] | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const { error, run } = useAction();
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    run(async () => {
      const [a, p] = await Promise.all([api("GET", "/api/applications"), api("GET", "/api/profile")]);
      setApps(a.applications);
      setHasProfile(Boolean(p.profile.name || p.profile.experience.length));
    });
  }, []);

  return (
    <>
      <Stats apps={apps ?? []} onNew={() => setComposing(true)} />
      <ErrorBox error={error} />
      {!hasProfile && (
        <div className="alert warn" style={{ marginBottom: 16 }}>
          <span>
            Profil CV kamu masih kosong. <Link to="/profile">Impor CV lamamu</Link> dulu supaya AI punya bahan.
          </span>
        </div>
      )}
      {composing && (
        <Modal title="Nilai lowongan baru" onClose={() => setComposing(false)}>
          <NewApplication />
        </Modal>
      )}
      {apps === null ? (
        <Loading />
      ) : apps.length > 0 ? (
        <>
        <div className="section-title">Lamaran terakhir</div>
        <div className="card flush rows">
          <div className="app-list">
            {apps.map((a) => (
              <Link key={a.id} to={`/applications/${a.id}`} className="app-row">
                <span className="co-avatar" aria-hidden>
                  {(a.company || a.role_title || "?").trim().slice(0, 1).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="title">{a.role_title || "Posisi tanpa judul"}</div>
                  <div className="company">{a.company || "Perusahaan belum diisi"}</div>
                </div>
                <div>{a.error && !a.fit_score ? <span className="chip bad dot">Analisis gagal</span> : <StatusChip status={a.status} />}</div>
                <div className="score">
                  <b>{a.fit_score ?? "-"}</b>
                  <span>{formatDate(a.updated_at).split(",")[0]}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        </>
      ) : null}
    </>
  );
}

function NewApplication() {
  const navigate = useNavigate();
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [cvLanguage, setCvLanguage] = useState("English");
  const [jobDescription, setJd] = useState("");
  const { busy, error, run } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => api<{ application: Application }>("POST", "/api/applications", { company, roleTitle, cvLanguage, jobDescription }));
    if (r) navigate(`/applications/${r.application.id}`);
  }

  return (
    <form className="stack modal-form" onSubmit={submit}>
      <textarea
        required
        aria-label="Deskripsi pekerjaan"
        value={jobDescription}
        onChange={(e) => setJd(e.target.value)}
        placeholder="Tempel deskripsi pekerjaan lengkap di sini: tanggung jawab, syarat wajib, dan nice-to-have."
      />
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="grow" style={{ minWidth: 180 }}>
          <Field label="Perusahaan">
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Sea Labs Indonesia" />
          </Field>
        </div>
        <div className="grow" style={{ minWidth: 180 }}>
          <Field label="Posisi">
            <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Backend Engineer" />
          </Field>
        </div>
        <div style={{ minWidth: 170 }}>
          <Field label="Bahasa CV">
            <select value={cvLanguage} onChange={(e) => setCvLanguage(e.target.value)}>
              <option>English</option>
              <option value="Bahasa Indonesia">Bahasa Indonesia</option>
            </select>
          </Field>
        </div>
        {!busy && (
          <button className="btn primary" type="submit" disabled={jobDescription.trim().length < 80}>
            <Sparkles size={17} /> Nilai kecocokan
          </button>
        )}
      </div>
      <ErrorBox error={error} />
      {busy && <Busy>Membaca lowongan dan membandingkan dengan profilmu</Busy>}
    </form>
  );
}

function Stats({ apps, onNew }: { apps: ApplicationSummary[]; onNew: () => void }) {
  const scored = apps.filter((a) => a.fit_score != null);
  const avg = scored.length ? Math.round(scored.reduce((n, a) => n + (a.fit_score ?? 0), 0) / scored.length) : null;
  const sent = apps.filter((a) => ["applied", "interview", "offer", "rejected"].includes(a.status)).length;
  const interviews = apps.filter((a) => a.status === "interview" || a.status === "offer").length;
  const ready = apps.filter((a) => a.versions > 0).length;
  return (
    <section className="hero">
      <span className="eyebrow">Rata-rata kecocokan</span>
      <div className="mega">
        {avg ?? "0"}
        <span>%</span>
      </div>
      <div className="hero-sub">dari {apps.length} lowongan yang sudah dinilai</div>
      <div className="kpis">
        <div>
          <span>CV siap</span>
          <b>{ready}</b>
        </div>
        <div>
          <span>Sudah dikirim</span>
          <b>{sent}</b>
        </div>
        <div>
          <span>Interview</span>
          <b>{interviews}</b>
        </div>
      </div>
      <button className="btn primary wide" onClick={onNew}>
        <Sparkles size={16} /> Nilai lowongan baru
      </button>
    </section>
  );
}
