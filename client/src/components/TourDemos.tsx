import { Check, Clipboard, FileText, Flag, Send, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Needle, SewTrack } from "./Sewing";

/**
 * Small looping animations for the tour: each one plays a step with example data
 * (a job post being pasted, scores counting up, a signature being drawn) so the flow is clear
 * before the user has any data of their own. Everything is a pure function of the clock `t`.
 */

const HOLD = 2600; // pause on the finished state before the loop restarts

function useClock(total: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setT(total);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setT(Math.min((now - start) % (total + HOLD), total));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);
  return t;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - (1 - clamp01(x)) ** 3;
/** Fraction of an animation that runs from `start` for `dur` ms. */
const prog = (t: number, start: number, dur: number) => ease((t - start) / dur);
const typed = (text: string, t: number, start: number, cps = 40) => text.slice(0, Math.max(0, Math.floor(((t - start) * cps) / 1000)));
const typeEnd = (text: string, start: number, cps = 40) => start + (text.length * 1000) / cps;

function Typed({ text, t, start, cps }: { text: string; t: number; start: number; cps?: number }) {
  const shown = typed(text, t, start, cps);
  const typing = t >= start && shown.length < text.length;
  return (
    <>
      {shown}
      {typing && <i className="td-caret" />}
    </>
  );
}

/** A mini app window. Give `h` when the content grows while it plays, so the card does not jump. */
function Win({ title, h, children }: { title: string; h?: number; children: ReactNode }) {
  return (
    <div className="td-win">
      <div className="td-bar">
        <i />
        <i />
        <i />
        <span>{title}</span>
      </div>
      <div className="td-body" style={h ? { height: h } : undefined}>
        {children}
      </div>
    </div>
  );
}

const JD = "DevOps Engineer · PT Nusantara Digital\nJakarta (Hybrid) · Penuh waktu\n\nKualifikasi: CI/CD (GitLab), Docker, Kubernetes, Terraform di AWS.";

/* ---------- Step demos ---------- */

export function DemoFlow() {
  const t = useClock(4200);
  const steps = ["Siapkan bahan", "Ukur lowongan", "Pas & jahit CV", "Kirim & isi form"];
  return (
    <div className="td-flow">
      {steps.map((s, k) => (
        <div key={s} className={`td-flow-step${t > 400 + k * 800 ? " on" : ""}`}>
          <b>{k + 1}</b>
          {s}
        </div>
      ))}
    </div>
  );
}

const BAHAN = [
  { k: "Identitas", v: "Rani Pratama · rani@mail.com" },
  { k: "Pengalaman", v: "3 peran, 14 poin" },
  { k: "Skill", v: "Docker, Go, AWS, +11" },
  { k: "Pendidikan", v: "S1 Teknik Informatika" },
];

export function DemoBahan() {
  const t = useClock(4200);
  const read = t > 500 && t < 1500;
  return (
    <Win title="Bahan CV" h={168}>
      <div className={`td-file${t > 300 ? " in" : ""}`}>
        <FileText size={14} /> CV_Rani_2025.pdf
        <span>{t < 500 ? "" : read ? "Benang memilah…" : "Terbaca"}</span>
      </div>
      <div className="td-bahan">
        {BAHAN.map((b, k) => {
          const at = 1500 + k * 450;
          return (
            <div key={b.k} className={t > at ? "ok" : ""}>
              <span>{b.k}</span>
              <b>{t > at ? b.v : "Kosong"}</b>
            </div>
          );
        })}
      </div>
    </Win>
  );
}

export function DemoCopy() {
  const t = useClock(4400);
  const sel = prog(t, 700, 700);
  const lines = [92, 70, 80];
  const move = prog(t, 2500, 700);
  return (
    <Win title="linkedin.com/jobs" h={150}>
      <div className="td-li-head">
        <div>
          <div className="td-li-title">DevOps Engineer</div>
          <div className="td-li-sub">PT Nusantara Digital · Jakarta</div>
        </div>
        {t > 1900 ? (
          <div className="td-toast">
            <Check size={12} /> Tersalin
          </div>
        ) : (
          <div className="td-keys">
            <kbd className={t > 500 ? "pop" : ""}>Ctrl</kbd>
            <kbd className={t > 500 ? "pop" : ""}>A</kbd>
            <span>lalu</span>
            <kbd className={t > 1700 ? "pop" : ""}>Ctrl</kbd>
            <kbd className={t > 1700 ? "pop" : ""}>C</kbd>
          </div>
        )}
      </div>
      {lines.map((w, k) => (
        <div key={k} className="td-line" style={{ width: `${w}%` }}>
          <span className="td-sel" style={{ transform: `scaleX(${clamp01(sel * lines.length - k)})` }} />
        </div>
      ))}
      <div className={`td-tile${t > 3200 ? " press" : ""}`} style={{ opacity: 0.35 + 0.65 * prog(t, 2500, 400) }}>
        <Clipboard size={13} /> Tempel hasil pencarian
      </div>
      <div className="td-cursor" style={{ opacity: prog(t, 2500, 300), transform: `translate(${330 - 170 * move}px, ${150 - 36 * move}px)` }} />
    </Win>
  );
}

export function DemoPaste() {
  const focus = "DevOps, Jabodetabek";
  const a = 300;
  const b = typeEnd(JD, a, 70) + 200;
  const send = typeEnd(focus, b, 26) + 300;
  const t = useClock(send + 1600);
  return (
    <Win title="Lowongan" h={178}>
      <div className="td-compose">
        <div className="td-text">
          <Typed text={JD} t={t} start={a} cps={70} />
          {t < a && <span className="td-ph">Tempel halaman lowongan di sini…</span>}
        </div>
        <div className="td-compose-bar">
          <div className="td-focus">
            Fokus: <Typed text={focus} t={t} start={b} cps={26} />
          </div>
          <div className={`td-send${t > send ? " press" : ""}`}>
            <Send size={12} />
          </div>
        </div>
      </div>
      {t > send + 250 && (
        <div className="td-status">
          <span className="sewing-cloth mini">
            <span className="sewing-stitches" />
            <span className="sewing-needle">
              <Needle />
            </span>
          </span>
          Benang lagi mengukur 3 lowongan…
        </div>
      )}
    </Win>
  );
}

const LEADS = [
  { role: "DevOps Engineer", co: "PT Nusantara Digital", fit: 92, size: "200–500 orang", rec: "Layak daftar" },
  { role: "Cloud Engineer", co: "Bank Sinar Jaya", fit: 74, size: "1.000+ orang", rec: "Coba aja" },
  { role: "IT Support", co: "PT Karir Cepat", fit: 38, size: "Tidak jelas", rec: "Lewati", flag: "Minta biaya rekrutmen" },
];

// Color stays a small status dot; numbers are monochrome.
function fitColor(v: number) {
  return v >= 80 ? "var(--lime)" : v >= 60 ? "var(--amber)" : "var(--rose)";
}

/** Measured jobs, laid out like the real Lowongan list: one list, hairline rows, score on the right. */
export function DemoResults() {
  const t = useClock(3400);
  return (
    <Win title="Hasil ukur">
      <div className="td-list">
        {LEADS.map((l, k) => {
          const at = 200 + k * 450;
          return (
            <div key={l.co} className="td-li-row" style={{ opacity: prog(t, at, 300), transform: `translateY(${(1 - prog(t, at, 500)) * 8}px)` }}>
              <span className="td-co">{l.co.replace(/^PT\s+/, "").slice(0, 1)}</span>
              <div className="td-li-main">
                <b>{l.role}</b>
                <span>
                  {l.co} · {l.size}
                </span>
                {l.flag && (
                  <span className="td-warn" style={{ opacity: prog(t, 1900, 300) }}>
                    <Flag size={10} /> {l.flag}
                  </span>
                )}
              </div>
              <div className="td-li-score">
                <b>{Math.round(l.fit * prog(t, at, 900))}</b>
                <span>
                  <i style={{ background: fitColor(l.fit) }} /> {l.rec}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Win>
  );
}

export function DemoStats() {
  const t = useClock(3000);
  const stats = [
    { label: "Diukur", v: 9, unit: "" },
    { label: "Dijahit", v: 6, unit: "" },
    { label: "Dikirim", v: 4, unit: "" },
    { label: "Interview", v: 2, unit: "" },
  ];
  return (
    <Win title="Lamaran" h={150}>
      <div className="td-stats">
        {stats.map((s, k) => (
          <div key={s.label} className="td-stat" style={{ opacity: prog(t, k * 180, 300) }}>
            <b>
              {Math.round(s.v * prog(t, k * 180, 1300))}
              {s.unit}
            </b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="td-track">
        <SewTrack done={[0, 1, 2, 3].map((k) => t > 1300 + k * 350)} />
      </div>
    </Win>
  );
}

export function DemoConfirm() {
  const q = "JD minta Kubernetes. Kamu pernah deploy ke cluster beneran?";
  const ans = "Belum, baru Docker Compose";
  const q2 = "Oke, Kubernetes tidak aku klaim. Docker Compose aku tonjolkan.";
  const a = 200;
  const b = typeEnd(q, a, 55) + 300;
  const c = typeEnd(ans, b, 24) + 400;
  const d = typeEnd(q2, c, 55) + 300;
  const t = useClock(d + 1800);
  return (
    <Win title="DevOps Engineer · Lamaran" h={238}>
      <div className="td-stage-row">
        <SewTrack compact done={[true, t > c, t > d, false]} />
        <span>{t > d ? "Jahit selesai, tinggal kirim" : t > c ? "Pas selesai, mulai menjahit" : "Tahap Pas: konfirmasi dulu"}</span>
      </div>
      <div className="td-chat">
        <div className="td-q">
          <Typed text={q} t={t} start={a} cps={55} />
        </div>
        {t > b - 100 && (
          <div className="td-a">
            <Typed text={ans} t={t} start={b} cps={24} />
          </div>
        )}
        {t > c - 100 && (
          <div className="td-q">
            <Typed text={q2} t={t} start={c} cps={55} />
          </div>
        )}
      </div>
      {t > d && (
        <div className="td-cv" style={{ opacity: prog(t, d, 300) }}>
          <FileText size={14} />
          <div>
            <b>CV_Rani_Pratama_DevOps.pdf</b>
            <div className="td-cv-lines">
              {[88, 64, 76].map((w, k) => (
                <i key={k} style={{ width: `${w * prog(t, d + 150 + k * 200, 500)}%` }} />
              ))}
            </div>
          </div>
          <span className="td-ok">
            <Check size={12} /> Dijahit
          </span>
        </div>
      )}
    </Win>
  );
}

const FORM = [
  { k: "Nama lengkap", v: "Rani Pratama" },
  { k: "Tempat, tgl lahir", v: "Bandung, 14 Mei 1999" },
  { k: "Pendidikan", v: "S1 Teknik Informatika, ITB" },
  { k: "Golongan darah", v: "O", ask: true },
];

export function DemoForm() {
  const t = useClock(4600);
  return (
    <Win title="Form_Data_Diri_PT_Nusantara.docx" h={172}>
      <div className="td-form">
        {FORM.map((f, k) => {
          const start = 300 + k * 700;
          return (
            <div key={f.k} className="td-field">
              <span>{f.k}</span>
              <div className={`td-input${f.ask && t > start && t < 3500 ? " asking" : ""}`}>
                {f.ask ? t >= 3500 && <Typed text={f.v} t={t} start={3500} cps={10} /> : <Typed text={f.v} t={t} start={start} cps={45} />}
                {!f.ask && t > typeEnd(f.v, start, 45) && <Check size={12} className="td-auto" />}
              </div>
            </div>
          );
        })}
      </div>
      {t > 2400 && t < 3500 && <div className="td-ask">Golongan darahmu apa? Aku ingat untuk form berikutnya.</div>}
    </Win>
  );
}

const SIG = "M8 46 C18 10 30 8 28 34 C26 54 16 52 24 30 C32 10 44 14 42 40 C48 22 56 18 58 34 C60 46 66 44 72 28 C76 18 82 24 80 36 C86 26 96 24 104 32 C112 40 124 30 150 26";

export function DemoSign() {
  const t = useClock(3600);
  const draw = prog(t, 300, 1800);
  return (
    <Win title="Form HR · Buku catatan Benang" h={158}>
      <div className="td-sign">
        <svg viewBox="0 0 160 60" className="td-sig">
          <path d={SIG} pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1 - draw }} />
        </svg>
        <div className="td-sign-line" />
        <span className="td-sign-cap">Gambar sekali di sini</span>
      </div>
      {t > 2300 && (
        <div className="td-stamp" style={{ opacity: prog(t, 2300, 300), transform: `scale(${1.15 - 0.15 * prog(t, 2300, 400)})` }}>
          <span>Form PT Nusantara · Tanda tangan</span>
          <svg viewBox="0 0 160 60" className="td-sig small">
            <path d={SIG} />
          </svg>
        </div>
      )}
    </Win>
  );
}

export function DemoProvider() {
  const key = "sk-ant-api03-7Hq2…xW9c";
  const t = useClock(4600);
  const keyDone = typeEnd(key, 200, 30);
  const failAt = keyDone + 900;
  const okAt = failAt + 900;
  const rows = [
    { name: "Claude", state: t > failAt ? "fail" : t > keyDone + 300 ? "try" : "" },
    { name: "OpenAI", state: t > okAt ? "ok" : t > failAt + 200 ? "try" : "" },
    { name: "Gemini", state: "" },
  ];
  return (
    <Win title="Provider AI" h={176}>
      <div className="td-key">
        <span>API key</span>
        <code>
          <Typed text={key} t={t} start={200} cps={30} />
        </code>
      </div>
      <div className="td-chain">
        {rows.map((r, k) => (
          <div key={r.name} className={`td-prov ${r.state}`}>
            <b>{k + 1}</b> {r.name}
            <span className="td-prov-state">
              {r.state === "try" && <span className="spinner" />}
              {r.state === "fail" && (
                <>
                  <X size={12} /> Timeout
                </>
              )}
              {r.state === "ok" && (
                <>
                  <Check size={12} /> Berhasil
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </Win>
  );
}
