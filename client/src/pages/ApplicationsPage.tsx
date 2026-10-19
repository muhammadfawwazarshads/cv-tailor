import { Briefcase, FileCheck2, MessagesSquare, Send, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatDate, STATUS_LABELS, STATUS_TONE, type Application, type ApplicationSummary } from "../api";
import { Busy, ErrorBox, Field, Loading, useAction } from "../components/ui";

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

  useEffect(() => {
    run(async () => {
      const [a, p] = await Promise.all([api("GET", "/api/applications"), api("GET", "/api/profile")]);
      setApps(a.applications);
      setHasProfile(Boolean(p.profile.name || p.profile.experience.length));
    });
  }, []);

  return (
    <>
      <div className="page-head">
        <span className="emblem" aria-hidden>
          <Briefcase size={20} strokeWidth={1.8} />
        </span>
        <div className="grow">
          <h1>Lamaran</h1>
          <p>Tempel deskripsi pekerjaan untuk mulai. Setiap lamaran menyimpan analisis, jawabanmu, dan semua versi CV-nya.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      {!hasProfile && (
        <div className="alert warn" style={{ marginBottom: 16 }}>
          <span>
            Profil CV kamu masih kosong. <Link to="/profile">Impor CV lamamu</Link> dulu supaya AI punya bahan.
          </span>
        </div>
      )}
      {apps && apps.length > 0 && <Stats apps={apps} />}
      <NewApplication />
      {apps === null ? (
        <Loading />
      ) : apps.length > 0 ? (
        <div className="card flush">
          <div className="app-list">
            {apps.map((a) => (
              <Link key={a.id} to={`/applications/${a.id}`} className="app-row">
                <div style={{ minWidth: 0 }}>
                  <div className="title">{a.role_title || "Posisi tanpa judul"}</div>
                  <div className="company">{a.company || "Perusahaan belum diisi"}</div>
                </div>
                <div>{a.error && !a.fit_score ? <span className="chip bad dot">Analisis gagal</span> : <StatusChip status={a.status} />}</div>
                <FitBar score={a.fit_score} />
                <div className="when">{formatDate(a.updated_at)}</div>
              </Link>
            ))}
          </div>
        </div>
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
    <form className="composer stack" onSubmit={submit}>
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

function Stats({ apps }: { apps: ApplicationSummary[] }) {
  const scored = apps.filter((a) => a.fit_score != null);
  const avg = scored.length ? Math.round(scored.reduce((n, a) => n + (a.fit_score ?? 0), 0) / scored.length) : null;
  const sent = apps.filter((a) => ["applied", "interview", "offer", "rejected"].includes(a.status)).length;
  const interviews = apps.filter((a) => a.status === "interview" || a.status === "offer").length;
  const ready = apps.filter((a) => a.versions > 0).length;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  // Fit score distribution for the sparkline: newest last.
  const bars = [...scored].reverse().slice(-12).map((a) => a.fit_score ?? 0);
  const cells = [
    { icon: <FileCheck2 size={15} />, v: ready, k: "CV siap kirim", of: apps.length, note: `${pct(ready, apps.length)}% dari lowongan` },
    { icon: <Send size={15} />, v: sent, k: "Sudah dikirim", of: ready || apps.length, note: ready ? `${pct(sent, ready)}% dari CV siap` : "Belum ada" },
    { icon: <MessagesSquare size={15} />, v: interviews, k: "Sampai interview", of: sent || 1, note: sent ? `${pct(interviews, sent)}% dari yang dikirim` : "Kirim dulu, lalu pantau" },
  ];
  return (
    <div className="stat-strip">
      <div className="big">
        <div>
          <span className="v iris">
            {avg ?? "-"}
            <small>%</small>
          </span>
          <span className="k">Rata-rata kecocokan dari {apps.length} lowongan</span>
        </div>
        <div className="spark" aria-hidden>
          {bars.map((b, i) => (
            <i key={i} style={{ height: `${Math.max(8, b)}%` }} className={b >= 70 ? "hi" : ""} />
          ))}
        </div>
      </div>
      {cells.map((c) => (
        <div key={c.k} className="cell">
          <span className="glyph">{c.icon}</span>
          <span className="v">{c.v}</span>
          <span className="k">{c.k}</span>
          <span className="meter" aria-hidden>
            <i style={{ width: `${c.of ? Math.min(100, (c.v / c.of) * 100) : 0}%` }} />
          </span>
          <span className="note">{c.note}</span>
        </div>
      ))}
    </div>
  );
}
