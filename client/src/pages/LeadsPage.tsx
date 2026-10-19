import {
  ArrowRight,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ClipboardPaste,
  EyeOff,
  FileText,
  Factory,
  Megaphone,
  Minus,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Application, type LeadRow } from "../api";
import { Mascot } from "../components/Mascot";
import { Busy, ErrorBox, Field, Loading, Toast, useAction } from "../components/ui";

const PREF_KEY = "cv-tailor:lead-preferences";
const FILTER_KEY = "cv-tailor:lead-filters";

const TIER: Record<string, { label: string; tone: string }> = {
  large: { label: "Perusahaan besar", tone: "fit" },
  mid: { label: "Menengah", tone: "blue" },
  small: { label: "Kecil", tone: "gap" },
  unknown: { label: "Tidak dikenal", tone: "" },
};
const REC: Record<string, { label: string; tone: string }> = {
  apply: { label: "Layak daftar", tone: "fit" },
  try: { label: "Coba aja", tone: "blue" },
  skip: { label: "Lewati", tone: "bad" },
};
const TABS = [
  { key: "new", label: "Baru" },
  { key: "saved", label: "Disimpan" },
  { key: "applied", label: "Sudah dilamar" },
  { key: "dismissed", label: "Diabaikan" },
  { key: "all", label: "Semua" },
] as const;

type Filters = { tab: string; tiers: string[]; hideFlags: boolean; manufacturing: boolean; minFit: number; q: string; sort: "fit" | "new" };
const DEFAULT_FILTERS: Filters = { tab: "new", tiers: [], hideFlags: false, manufacturing: false, minFit: 0, q: "", sort: "fit" };

/** "Paling cocok": recommendation first (skip and red flags sink), then fit score. */
const REC_WEIGHT: Record<string, number> = { apply: 2, try: 1, skip: 0 };
const rank = (l: LeadRow) => REC_WEIGHT[l.data.recommendation] * 1000 - (l.data.redFlags.length ? 500 : 0) + l.data.fitScore;

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    /* storage unavailable: preferences just won't persist */
  }
}

export function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [filters, setFilters] = useState<Filters>(() => readStore(FILTER_KEY, DEFAULT_FILTERS));
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { error, run } = useAction();

  useEffect(() => {
    run(async () => setLeads((await api<{ leads: LeadRow[] }>("GET", "/api/leads")).leads));
  }, []);
  useEffect(() => writeStore(FILTER_KEY, filters), [filters]);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const activeFilters = filters.tiers.length + (filters.minFit ? 1 : 0) + (filters.hideFlags ? 1 : 0) + (filters.manufacturing ? 1 : 0);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads?.length ?? 0 };
    for (const l of leads ?? []) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const shown = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return (leads ?? [])
      .filter((l) => filters.tab === "all" || l.status === filters.tab)
      .filter((l) => !filters.tiers.length || filters.tiers.includes(l.data.companyTier))
      .filter((l) => !filters.hideFlags || !l.data.redFlags.length)
      .filter((l) => !filters.manufacturing || l.data.manufacturing)
      .filter((l) => l.data.fitScore >= filters.minFit)
      .filter((l) => !q || `${l.title} ${l.company} ${l.data.location} ${l.data.category}`.toLowerCase().includes(q))
      .sort((a, b) => (filters.sort === "fit" ? rank(b) - rank(a) : 0) || b.created_at.localeCompare(a.created_at));
  }, [leads, filters]);

  function added(res: { leads: LeadRow[]; found: number; skipped: number }) {
    setLeads((cur) => {
      const ids = new Set(res.leads.map((l) => l.id));
      return [...res.leads, ...(cur ?? []).filter((l) => !ids.has(l.id))];
    });
    if (!res.found) setNotice("Tidak ada lowongan yang terbaca dari teks itu. Pastikan halaman lowongannya ikut tersalin.");
    else setNotice(`${res.found} lowongan terbaca: ${res.leads.length} baru atau diperbarui${res.skipped ? `, ${res.skipped} sudah ada sebelumnya` : ""}.`);
    set({ tab: "new" });
  }

  function replace(lead: LeadRow) {
    setLeads((cur) => (cur ?? []).map((l) => (l.id === lead.id ? lead : l)));
  }

  return (
    <>
      <section className="hero">
        <Mascot size={96} pose="idle" className="hero-mascot" />
        <span className="eyebrow">Langkah 2 · Ukur lowongan</span>
        <h1>Lowongan mana yang mau dinilai?</h1>
      </section>
      <PasteBox onAdded={added} />
      {notice && <Toast text={notice} onDone={() => setNotice(null)} />}
      <ErrorBox error={error} />

      {leads === null ? (
        <Loading />
      ) : leads.length === 0 ? null : (
        <>
          <div className="section-title">Hasil penilaian</div>
          <div className="toolbar">
            <div className="segmented" role="tablist">
              {TABS.map((t) => (
                <button key={t.key} role="tab" aria-selected={filters.tab === t.key} className={filters.tab === t.key ? "active" : ""} onClick={() => set({ tab: t.key })}>
                  {t.label} <span className="n">{counts[t.key] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="toolbar-right">
              <label className="search mini">
                <Search size={15} />
                <input type="text" aria-label="Cari lowongan" placeholder="Cari" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
              </label>
              <button className={`btn sm${activeFilters ? " on" : ""}`} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
                <SlidersHorizontal size={15} /> Filter{activeFilters ? ` (${activeFilters})` : ""}
              </button>
            </div>
          </div>
          {showFilters && (
            <div className="popover-panel">
              <div className="pp-row">
                <span className="pp-label">Ukuran perusahaan</span>
                <div className="seg-mini">
                  {(["large", "mid", "small", "unknown"] as const).map((t) => {
                    const on = filters.tiers.includes(t);
                    return (
                      <button key={t} type="button" aria-pressed={on} className={on ? "on" : ""} onClick={() => set({ tiers: on ? filters.tiers.filter((x) => x !== t) : [...filters.tiers, t] })}>
                        {TIER[t].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="pp-row">
                <span className="pp-label">Skor minimal</span>
                <div className="seg-mini">
                  {[0, 50, 70].map((v) => (
                    <button key={v} type="button" aria-pressed={filters.minFit === v} className={filters.minFit === v ? "on" : ""} onClick={() => set({ minFit: v })}>
                      {v ? `${v}+` : "Semua"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pp-row">
                <span className="pp-label">Urutkan</span>
                <div className="seg-mini">
                  <button type="button" className={filters.sort === "fit" ? "on" : ""} onClick={() => set({ sort: "fit" })}>Paling cocok</button>
                  <button type="button" className={filters.sort === "new" ? "on" : ""} onClick={() => set({ sort: "new" })}>Terbaru</button>
                </div>
              </div>
              <div className="pp-row">
                <label className="check">
                  <input type="checkbox" checked={filters.hideFlags} onChange={(e) => set({ hideFlags: e.target.checked })} /> Tanpa tanda bahaya
                </label>
                <label className="check">
                  <input type="checkbox" checked={filters.manufacturing} onChange={(e) => set({ manufacturing: e.target.checked })} /> Manufaktur saja
                </label>
              </div>
            </div>
          )}

          {shown.length ? (
            <div className="leads rows" data-tour="results">
              {shown.map((l) => (
                <LeadCard key={l.id} lead={l} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} onChange={replace} onDelete={() => setLeads((cur) => (cur ?? []).filter((x) => x.id !== l.id))} />
              ))}
            </div>
          ) : (
            <div className="card empty">
              <h2>Tidak ada yang cocok dengan filter ini</h2>
              <p>Longgarkan filter atau pindah tab.</p>
              <button className="btn" onClick={() => setFilters({ ...DEFAULT_FILTERS, tab: filters.tab })}>
                Reset filter
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function PasteBox({ onAdded }: { onAdded: (r: { leads: LeadRow[]; found: number; skipped: number }) => void }) {
  const [text, setText] = useState("");
  const [preferences, setPreferences] = useState(() => {
    try {
      return localStorage.getItem(PREF_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const { busy, error, run } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    writeStore(PREF_KEY, preferences);
    const r = await run(() => api<{ leads: LeadRow[]; found: number; skipped: number }>("POST", "/api/leads/extract", { text, preferences }));
    if (r) {
      setText("");
      onAdded(r);
    }
  }

  async function pasteClipboard() {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      /* clipboard permission denied: the user can paste manually */
    }
  }

  return (
    <>
      {!text && !busy && (
        <div className="starters" data-tour="starters">
          {STARTERS.map((st) => (
            <button key={st.title} type="button" className={`starter ${st.tone}`} onClick={pasteClipboard} title={st.text}>
              <st.icon size={16} strokeWidth={1.8} aria-hidden />
              <b>{st.title}</b>
            </button>
          ))}
        </div>
      )}
      <form className="composer chat" onSubmit={submit} data-tour="composer">
        <textarea
          aria-label="Teks halaman lowongan"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tempel halaman lowongan di sini..."
        />
        <div className="chat-bar">
          <label className="focus-pill" title="Fokus pencarian, disimpan di browser ini dan dipakai setiap kali menilai">
            <Target size={15} />
            <input
              type="text"
              aria-label="Fokus pencarian"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="Fokus: software engineer, DevOps, data. Jabodetabek."
            />
          </label>
          {!busy && (
            <>
              {"clipboard" in navigator && (
                <button className="icon-btn" type="button" onClick={pasteClipboard} aria-label="Tempel dari clipboard" title="Tempel dari clipboard">
                  <ClipboardPaste size={17} />
                </button>
              )}
              <button className="send" type="submit" disabled={text.trim().length < 40} aria-label="Pilah lowongan" title="Pilah lowongan">
                <ArrowUp size={18} strokeWidth={2.4} />
              </button>
            </>
          )}
        </div>
        <ErrorBox error={error} />
        {busy && <Busy>Mengukur lowongan, menilai perusahaan, dan mencocokkan dengan Bahan CV-mu</Busy>}
      </form>
    </>
  );
}

const STARTERS = [
  { title: "Tempel hasil pencarian Jobs", text: "Semua kartu di daftar ikut terbaca sebagai ringkasan.", tone: "a", icon: Search },
  { title: "Tempel satu lowongan lengkap", text: "Deskripsinya utuh, bisa langsung jadi lamaran.", tone: "b", icon: FileText },
  { title: "Tempel postingan rekrutmen", text: "Postingan HR atau agensi di feed LinkedIn.", tone: "c", icon: Megaphone },
];

function LeadCard({ lead, open, onToggle, onChange, onDelete }: { lead: LeadRow; open: boolean; onToggle: () => void; onChange: (l: LeadRow) => void; onDelete: () => void }) {
  const d = lead.data;
  const navigate = useNavigate();
  const [jd, setJd] = useState("");
  const [cvLanguage, setCvLanguage] = useState("English");
  const act = useAction();
  const complete = d.jobDescription.trim().length >= 80;
  const mode = d.workMode && !d.location.toLowerCase().includes(d.workMode.toLowerCase()) ? d.workMode : "";
  const meta = [d.location, mode, d.employmentType, d.seniority].filter(Boolean).join(" · ");

  async function setStatus(status: LeadRow["status"]) {
    const r = await act.run(() => api<{ lead: LeadRow }>("PATCH", `/api/leads/${lead.id}`, { status }));
    if (r) onChange(r.lead);
  }
  async function saveJd() {
    const r = await act.run(() => api<{ lead: LeadRow }>("PATCH", `/api/leads/${lead.id}`, { jobDescription: jd }));
    if (r) {
      onChange(r.lead);
      setJd("");
    }
  }
  async function apply() {
    const r = await act.run(() => api<{ application: Application }>("POST", `/api/leads/${lead.id}/apply`, { cvLanguage }));
    if (r) navigate(`/applications/${r.application.id}`);
  }
  async function remove() {
    const r = await act.run(() => api("DELETE", `/api/leads/${lead.id}`));
    if (r) onDelete();
  }

  return (
    <article className={`lead${open ? " open" : ""}${lead.status === "dismissed" ? " dim" : ""}`}>
      <button className="lead-head" onClick={onToggle} aria-expanded={open}>
        <span className={`co-avatar ${d.recommendation}`} aria-hidden>
          {(lead.company || lead.title).trim().slice(0, 1).toUpperCase()}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="title">{lead.title}</div>
          <div className="company">
            {lead.company || "Perusahaan tidak disebut"}
            {meta && <span className="muted"> · {meta}</span>}
          </div>
          <div className="lead-meta">
            <span className={`rec ${d.recommendation}`}>{REC[d.recommendation].label}</span>
            <span>{TIER[d.companyTier].label}</span>
            {d.category && <span>{d.category}</span>}
            {d.manufacturing && (
              <span>
                <Factory size={13} /> Manufaktur
              </span>
            )}
            {!d.hasDetails && <span>Baru ringkasan</span>}
            {lead.status === "saved" && (
              <span>
                <BookmarkCheck size={13} /> Disimpan
              </span>
            )}
            {d.redFlags.length > 0 && (
              <span className="warn">
                <TriangleAlert size={13} /> {d.redFlags.length} tanda bahaya
              </span>
            )}
          </div>
        </div>
        <div className="score">
          <b>{d.fitScore}</b>
          <span>kecocokan</span>
        </div>
        <ChevronDown size={18} className="chev" />
      </button>

      {open && (
        <div className="lead-body">
          {d.fitReason && <p>{d.fitReason}</p>}
          {d.companyNote && (
            <p className="muted small">
              <b>Tentang perusahaan (perkiraan AI):</b> {d.companyNote}
            </p>
          )}
          {d.redFlags.length > 0 && (
            <div className="alert error">
              <TriangleAlert size={17} style={{ marginTop: 1 }} />
              <span>{d.redFlags.join("\n")}</span>
            </div>
          )}
          <div className="grid-2">
            <ul className="evidence">
              {d.matched.map((m) => (
                <li key={m}>
                  <span className="mark fit">
                    <Check size={13} />
                  </span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
            <ul className="evidence">
              {d.missing.map((m) => (
                <li key={m}>
                  <span className="mark gap">
                    <Minus size={13} />
                  </span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
          <dl className="facts-grid">
            {d.applyInfo && (
              <>
                <dt>Cara melamar</dt>
                <dd>{d.applyInfo}</dd>
              </>
            )}
            {d.postedAt && (
              <>
                <dt>Diposting</dt>
                <dd>{d.postedAt}</dd>
              </>
            )}
            {d.deadline && (
              <>
                <dt>Batas waktu</dt>
                <dd>{d.deadline}</dd>
              </>
            )}
          </dl>

          {!complete && lead.status !== "applied" && (
            <div className="stack">
              <Field label="Lengkapi deskripsi" hint="Lowongan ini baru terbaca dari kartu ringkasnya. Buka lowongannya, salin deskripsi lengkap, lalu tempel di sini.">
                <textarea value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Tanggung jawab, syarat wajib, nice-to-have..." />
              </Field>
              <div>
                <button className="btn" disabled={jd.trim().length < 80 || act.busy} onClick={saveJd}>
                  Simpan deskripsi
                </button>
              </div>
            </div>
          )}

          <ErrorBox error={act.error} />
          {act.busy ? (
            <Busy>Memproses</Busy>
          ) : (
            <div className="row">
              {lead.application_id ? (
                <Link className="btn primary" to={`/applications/${lead.application_id}`}>
                  Buka lamaran <ArrowRight size={17} />
                </Link>
              ) : (
                complete && (
                  <>
                    <select aria-label="Bahasa CV" value={cvLanguage} onChange={(e) => setCvLanguage(e.target.value)} style={{ width: "auto" }}>
                      <option>English</option>
                      <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                    </select>
                    <button className="btn primary" onClick={apply}>
                      Buat lamaran &amp; CV <ArrowRight size={17} />
                    </button>
                  </>
                )
              )}
              {lead.status === "new" && (
                <button className="btn" onClick={() => setStatus("saved")}>
                  <Bookmark size={16} /> Simpan
                </button>
              )}
              {lead.status !== "dismissed" && lead.status !== "applied" && (
                <button className="btn ghost" onClick={() => setStatus("dismissed")}>
                  <EyeOff size={16} /> Abaikan
                </button>
              )}
              {(lead.status === "dismissed" || lead.status === "saved") && (
                <button className="btn ghost" onClick={() => setStatus("new")}>
                  <Undo2 size={16} /> Kembalikan ke Baru
                </button>
              )}
              <button className="btn ghost danger" onClick={remove} style={{ marginLeft: "auto" }}>
                <Trash2 size={16} /> Hapus
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
