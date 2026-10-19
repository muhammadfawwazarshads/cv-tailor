import { ArrowDown, ArrowUp, Check, Download, FileUp, Plus, Upload, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, formatDate, STANDALONE, type Fact, type Profile } from "../api";
import { Busy, ErrorBox, Field, Loading, Spinner, useAction } from "../components/ui";

type Exp = Profile["experience"][number];
type Edu = Profile["education"][number];
type Proj = Profile["projects"][number];

const lines = (s: string) => s.split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Textarea that edits a string[] as one item per line, keeping the user's typing intact. */
function LinesInput({ value, onChange, rows = 4, placeholder }: { value: string[]; onChange: (v: string[]) => void; rows?: number; placeholder?: string }) {
  const [text, setText] = useState(value.join("\n"));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value.join("\n"));
      last.current = value;
    }
  }, [value]);
  return (
    <textarea
      rows={rows}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const v = lines(e.target.value);
        last.current = v;
        onChange(v);
      }}
    />
  );
}

function ItemTools({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <div className="tools">
      <button className="icon-btn" type="button" onClick={onUp} title="Naikkan" aria-label="Naikkan">
        <ArrowUp size={16} />
      </button>
      <button className="icon-btn" type="button" onClick={onDown} title="Turunkan" aria-label="Turunkan">
        <ArrowDown size={16} />
      </button>
      <button className="icon-btn" type="button" onClick={onRemove} title="Hapus" aria-label="Hapus">
        <X size={16} />
      </button>
    </div>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useAction();
  const save = useAction();

  useEffect(() => {
    load.run(async () => {
      const r = await api("GET", "/api/profile");
      setProfile(r.profile);
      setUpdatedAt(r.updatedAt);
    });
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!profile) return load.error ? <ErrorBox error={load.error} /> : <Loading />;

  const set = (patch: Partial<Profile>) => {
    setProfile({ ...profile, ...patch });
    setDirty(true);
    setSaved(false);
  };
  const setContact = (k: keyof Profile["contact"], v: string) => set({ contact: { ...profile.contact, [k]: v } });

  async function doSave() {
    const r = await save.run(() => api("PUT", "/api/profile", { profile }));
    if (r) {
      setProfile(r.profile);
      setDirty(false);
      setSaved(true);
      setUpdatedAt(new Date().toISOString());
    }
  }

  const exp = (i: number, patch: Partial<Exp>) => set({ experience: profile.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const edu = (i: number, patch: Partial<Edu>) => set({ education: profile.education.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const proj = (i: number, patch: Partial<Proj>) => set({ projects: profile.projects.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const sectionNames = [...new Set(["Work Experience", ...profile.experience.map((e) => e.section).filter(Boolean)])];

  return (
    <>
      <div className="page-head">
        <span className="emblem" aria-hidden>
          <UserRound size={20} strokeWidth={1.8} />
        </span>
        <div className="grow">
          <h1>Profil CV</h1>
          <p>Semua CV dibuat dari halaman ini. Tulis pengalamanmu selengkap mungkin, termasuk angka. AI hanya memilih dan merangkai ulang, tidak pernah menambah.</p>
        </div>
      </div>

      <div className="stack">
        <ImportCard
          onImported={(p) => {
            setProfile(p);
            setDirty(true);
            setSaved(false);
          }}
        />

        <Section title="Identitas & kontak">
          <div className="grid-2">
            <Field label="Nama lengkap">
              <input type="text" value={profile.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Headline default" hint="AI menyesuaikan headline per lowongan.">
              <input type="text" value={profile.headline} onChange={(e) => set({ headline: e.target.value })} />
            </Field>
            <Field label="Email">
              <input type="email" value={profile.contact.email} onChange={(e) => setContact("email", e.target.value)} />
            </Field>
            <Field label="Telepon">
              <input type="text" value={profile.contact.phone} onChange={(e) => setContact("phone", e.target.value)} />
            </Field>
            <Field label="Website / portfolio">
              <input type="text" value={profile.contact.website} onChange={(e) => setContact("website", e.target.value)} />
            </Field>
            <Field label="LinkedIn">
              <input type="text" value={profile.contact.linkedin} onChange={(e) => setContact("linkedin", e.target.value)} />
            </Field>
            <Field label="Lokasi">
              <input type="text" value={profile.contact.location} onChange={(e) => setContact("location", e.target.value)} />
            </Field>
          </div>
          <Field label="Ringkasan default">
            <textarea rows={4} value={profile.summary} onChange={(e) => set({ summary: e.target.value })} />
          </Field>
        </Section>

        <Section
          title="Skill"
          hint="Kelompokkan per kategori. Pisahkan item dengan koma."
          action={
            <button className="btn sm" type="button" onClick={() => set({ skills: [...profile.skills, { category: "", items: "" }] })}>
              <Plus size={15} /> Kategori
            </button>
          }
        >
          {profile.skills.map((s, i) => (
            <div className="row" key={i} style={{ alignItems: "flex-start" }}>
              <input
                type="text"
                style={{ maxWidth: 220 }}
                placeholder="Kategori"
                value={s.category}
                onChange={(e) => set({ skills: profile.skills.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)) })}
              />
              <input
                type="text"
                className="grow"
                style={{ width: "auto", minWidth: 200 }}
                placeholder="Go, Python, PostgreSQL, ..."
                value={s.items}
                onChange={(e) => set({ skills: profile.skills.map((x, j) => (j === i ? { ...x, items: e.target.value } : x)) })}
              />
              <ItemTools
                onUp={() => set({ skills: move(profile.skills, i, -1) })}
                onDown={() => set({ skills: move(profile.skills, i, 1) })}
                onRemove={() => set({ skills: profile.skills.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          {!profile.skills.length && <p className="muted">Belum ada skill.</p>}
        </Section>

        <Section
          title="Pengalaman"
          hint="Kerja, magang, freelance, organisasi. Satu bullet per baris. Tulis selengkap mungkin, termasuk angka."
          action={
            <button
              className="btn sm"
              type="button"
              onClick={() =>
                set({
                  experience: [
                    { id: uid("exp"), section: "Work Experience", organization: "", role: "", location: "", start: "", end: "", bullets: [] },
                    ...profile.experience,
                  ],
                })
              }
            >
              <Plus size={15} /> Pengalaman
            </button>
          }
        >
          <datalist id="section-names">
            {sectionNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {profile.experience.map((e, i) => (
            <div className="editor-item stack" key={e.id || i}>
              <div className="row">
                <b className="grow">{e.organization || "Pengalaman baru"}</b>
                <ItemTools
                  onUp={() => set({ experience: move(profile.experience, i, -1) })}
                  onDown={() => set({ experience: move(profile.experience, i, 1) })}
                  onRemove={() => confirm("Hapus pengalaman ini?") && set({ experience: profile.experience.filter((_, j) => j !== i) })}
                />
              </div>
              <div className="grid-3">
                <Field label="Organisasi">
                  <input type="text" value={e.organization} onChange={(ev) => exp(i, { organization: ev.target.value })} />
                </Field>
                <Field label="Peran">
                  <input type="text" value={e.role} onChange={(ev) => exp(i, { role: ev.target.value })} />
                </Field>
                <Field label="Bagian di CV">
                  <input type="text" list="section-names" value={e.section} onChange={(ev) => exp(i, { section: ev.target.value })} />
                </Field>
                <Field label="Lokasi">
                  <input type="text" value={e.location} onChange={(ev) => exp(i, { location: ev.target.value })} />
                </Field>
                <Field label="Mulai">
                  <input type="text" placeholder="Jul 2025" value={e.start} onChange={(ev) => exp(i, { start: ev.target.value })} />
                </Field>
                <Field label="Selesai">
                  <input type="text" placeholder="Present" value={e.end} onChange={(ev) => exp(i, { end: ev.target.value })} />
                </Field>
              </div>
              <Field label="Bullet (satu per baris)">
                <LinesInput value={e.bullets} onChange={(b) => exp(i, { bullets: b })} rows={Math.max(3, e.bullets.length + 1)} />
              </Field>
            </div>
          ))}
          {!profile.experience.length && <p className="muted">Belum ada pengalaman.</p>}
        </Section>

        <Section
          title="Pendidikan"
          action={
            <button
              className="btn sm"
              type="button"
              onClick={() => set({ education: [...profile.education, { id: uid("edu"), institution: "", location: "", degree: "", start: "", end: "", bullets: [] }] })}
            >
              <Plus size={15} /> Pendidikan
            </button>
          }
        >
          {profile.education.map((e, i) => (
            <div className="editor-item stack" key={e.id || i}>
              <div className="row">
                <b className="grow">{e.institution || "Pendidikan baru"}</b>
                <ItemTools
                  onUp={() => set({ education: move(profile.education, i, -1) })}
                  onDown={() => set({ education: move(profile.education, i, 1) })}
                  onRemove={() => set({ education: profile.education.filter((_, j) => j !== i) })}
                />
              </div>
              <div className="grid-3">
                <Field label="Institusi">
                  <input type="text" value={e.institution} onChange={(ev) => edu(i, { institution: ev.target.value })} />
                </Field>
                <Field label="Gelar / jurusan">
                  <input type="text" value={e.degree} onChange={(ev) => edu(i, { degree: ev.target.value })} />
                </Field>
                <Field label="Lokasi">
                  <input type="text" value={e.location} onChange={(ev) => edu(i, { location: ev.target.value })} />
                </Field>
                <Field label="Mulai">
                  <input type="text" value={e.start} onChange={(ev) => edu(i, { start: ev.target.value })} />
                </Field>
                <Field label="Selesai">
                  <input type="text" value={e.end} onChange={(ev) => edu(i, { end: ev.target.value })} />
                </Field>
              </div>
              <Field label="Detail (skripsi, IPK, organisasi; satu per baris)">
                <LinesInput value={e.bullets} onChange={(b) => edu(i, { bullets: b })} rows={3} />
              </Field>
            </div>
          ))}
        </Section>

        <Section
          title="Project"
          action={
            <button
              className="btn sm"
              type="button"
              onClick={() => set({ projects: [...profile.projects, { id: uid("proj"), name: "", role: "", tech: "", link: "", bullets: [] }] })}
            >
              <Plus size={15} /> Project
            </button>
          }
        >
          {profile.projects.map((p, i) => (
            <div className="editor-item stack" key={p.id || i}>
              <div className="row">
                <b className="grow">{p.name || "Project baru"}</b>
                <ItemTools
                  onUp={() => set({ projects: move(profile.projects, i, -1) })}
                  onDown={() => set({ projects: move(profile.projects, i, 1) })}
                  onRemove={() => set({ projects: profile.projects.filter((_, j) => j !== i) })}
                />
              </div>
              <div className="grid-2">
                <Field label="Nama project">
                  <input type="text" value={p.name} onChange={(ev) => proj(i, { name: ev.target.value })} />
                </Field>
                <Field label="Peran">
                  <input type="text" value={p.role} onChange={(ev) => proj(i, { role: ev.target.value })} />
                </Field>
                <Field label="Tech stack">
                  <input type="text" value={p.tech} onChange={(ev) => proj(i, { tech: ev.target.value })} />
                </Field>
                <Field label="Link">
                  <input type="text" value={p.link} onChange={(ev) => proj(i, { link: ev.target.value })} />
                </Field>
              </div>
              <Field label="Bullet (satu per baris)">
                <LinesInput value={p.bullets} onChange={(b) => proj(i, { bullets: b })} rows={3} />
              </Field>
            </div>
          ))}
        </Section>

        <Section title="Sertifikasi" hint="Satu per baris.">
          <LinesInput value={profile.certifications} onChange={(c) => set({ certifications: c })} rows={3} />
        </Section>

        <ErrorBox error={save.error} />
        <div className="savebar">
          <span className="state">
            {dirty ? (
              "Ada perubahan yang belum disimpan"
            ) : saved ? (
              <>
                <Check size={16} /> Profil tersimpan
              </>
            ) : updatedAt ? (
              `Terakhir disimpan ${formatDate(updatedAt)}`
            ) : (
              "Belum pernah disimpan"
            )}
          </span>
          <button className="btn primary" onClick={doSave} disabled={save.busy || !dirty}>
            {save.busy && <Spinner />}
            Simpan profil
          </button>
        </div>

        <FactsCard />
        {STANDALONE && <BackupCard />}
      </div>
    </>
  );
}

function ImportCard({ onImported }: { onImported: (p: Profile) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const act = useAction();

  async function extract() {
    const form = new FormData();
    if (file) form.append("file", file);
    else form.append("text", text);
    const r = await act.run(() => api<{ profile: Profile }>("POST", "/api/profile/import", form));
    if (r) {
      onImported(r.profile);
      setDone(true);
      setOpen(false);
    }
  }

  return (
    <Section
      title="Mulai dari CV lamamu"
      hint="Unggah PDF atau tempel teksnya. AI mengisi halaman ini, lalu kamu periksa dan simpan."
      action={
        !open && (
          <button className="btn dark sm" type="button" onClick={() => setOpen(true)}>
            <FileUp size={15} /> Impor CV
          </button>
        )
      }
    >
      {done && <div className="alert ok">Profil terisi dari CV. Periksa isinya, lalu tekan Simpan profil di bawah.</div>}
      {open && (
        <div className="stack">
          <label className="file-drop">
            <FileUp size={22} />
            <span className="grow">
              <b>{file ? file.name : "Pilih file PDF"}</b>
              <span className="small muted" style={{ display: "block" }}>
                {file ? "Klik untuk mengganti file" : "CV berbasis teks, bukan hasil scan"}
              </span>
            </span>
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {!file && (
            <Field label="Atau tempel teks CV">
              <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
          )}
          <div className="alert warn">Isi halaman ini akan diganti hasil impor.</div>
          <ErrorBox error={act.error} />
          {act.busy ? (
            <Busy>Membaca CV-mu</Busy>
          ) : (
            <div className="row">
              <button className="btn primary" type="button" onClick={extract} disabled={!file && text.trim().length < 50}>
                Ekstrak dengan AI
              </button>
              <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
                Batal
              </button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function FactsCard() {
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [text, setText] = useState("");
  const act = useAction();

  const refresh = () => api("GET", "/api/facts").then((r) => setFacts(r.facts));
  useEffect(() => {
    refresh();
  }, []);

  return (
    <Section
      title="Fakta yang sudah kamu konfirmasi"
      hint="Jawaban dan detail yang pernah kamu berikan. AI memakainya di semua lamaran berikutnya."
    >
      <div className="row" style={{ alignItems: "flex-start" }}>
        <textarea
          className="grow"
          rows={2}
          style={{ width: "auto", minWidth: 220 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='mis. "Di project BUMD saya setup Nginx untuk path routing di environment dev, UAT, prod"'
        />
        <button
          className="btn"
          disabled={act.busy || text.trim().length < 3}
          onClick={() =>
            act.run(async () => {
              await api("POST", "/api/facts", { text });
              setText("");
              await refresh();
            })
          }
        >
          <Plus size={15} /> Tambah
        </button>
      </div>
      <ErrorBox error={act.error} />
      {facts === null ? (
        <Loading />
      ) : facts.length ? (
        <ul className="facts">
          {facts.map((f) => (
            <li key={f.id}>
              <div className="grow">
                {f.text}
                <div className="meta">
                  {f.company ? `Dari lamaran ${[f.role_title, f.company].filter(Boolean).join(" di ")}, ` : "Ditambahkan "}
                  {formatDate(f.created_at)}
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label="Hapus fakta"
                onClick={async () => {
                  await api("DELETE", `/api/facts/${f.id}`);
                  refresh();
                }}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Belum ada. Fakta akan bertambah saat kamu menjawab pertanyaan di lamaran.</p>
      )}
    </Section>
  );
}

function BackupCard() {
  const [msg, setMsg] = useState<string | null>(null);
  const act = useAction();

  async function doExport() {
    const { exportData } = await import("../local/server");
    const blob = new Blob([exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cv-tailor-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("File cadangan diunduh. API key tidak ikut disimpan.");
  }

  async function doImport(file: File) {
    if (!confirm("Data di browser ini akan diganti isi file cadangan. Lanjutkan?")) return;
    await act.run(async () => {
      const { importData } = await import("../local/server");
      importData(await file.text());
      location.reload();
    });
  }

  return (
    <Section
      title="Cadangan data"
      hint="Semua data versi ini tersimpan di browser ini saja. Unduh cadangan secara berkala, dan pakai file yang sama untuk memindahkan data ke browser atau komputer lain."
    >
      <div className="row">
        <button className="btn dark sm" type="button" onClick={doExport}>
          <Download size={15} /> Unduh cadangan
        </button>
        <label className="btn sm" style={{ position: "relative" }}>
          <Upload size={15} /> Pulihkan dari file
          <input
            type="file"
            accept="application/json,.json"
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
        </label>
      </div>
      {msg && <div className="alert ok">{msg}</div>}
      <ErrorBox error={act.error} />
    </Section>
  );
}
