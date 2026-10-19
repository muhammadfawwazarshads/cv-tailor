import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { APP_NAME } from "../brand";
import { Mascot, type MascotPose } from "./Mascot";
import { DemoBahan, DemoConfirm, DemoCopy, DemoFlow, DemoForm, DemoPaste, DemoProvider, DemoResults, DemoSign, DemoStats } from "./TourDemos";

/**
 * Guided product tour: a spotlight glides from one part of the app to the next while a card explains it.
 * Steps can switch pages; a step whose element is missing falls back to a centered card.
 * Benang the mascot rides along in the card, pointing at the spotlight, and each step plays a short
 * demo with example data so the flow makes sense before the user has data of their own.
 */
// The four chapters of the flow; each step says which one it belongs to so the order reads as one story.
const CHAPTERS = ["Siapkan bahan", "Ukur lowongan", "Pas & jahit CV", "Kirim & isi form"];
type Step = { route?: string; target?: string; chapter?: number; title: string; body: string; place?: "bottom" | "top" | "right" | "left"; demo?: ComponentType };

const STEPS: Step[] = [
  {
    title: "Halo, aku Benang",
    demo: DemoFlow,
    body: `Di ${APP_NAME}, CV-mu dijahit ulang untuk tiap lowongan, seperti penjahit mengepas baju: diukur dulu, baru dipotong. Ada empat langkah: siapkan bahan, ukur lowongan, pas & jahit CV, lalu kirim. Tur ini kurang dari satu menit.`,
  },
  {
    route: "/profile",
    target: '[data-tour="bahan"]',
    chapter: 0,
    title: "Siapkan bahannya dulu",
    demo: DemoBahan,
    body: "Ini Bahan CV: semua pengalaman, skill, dan pendidikanmu. Ceritakan ke Benang lewat obrolan, atau impor CV lamamu. Semua CV nanti dijahit dari bahan ini, tanpa ditambah-tambah.",
    place: "bottom",
  },
  {
    route: "/leads",
    target: '[data-tour="starters"]',
    chapter: 1,
    title: "Bahan siap? Cari lowongannya",
    demo: DemoCopy,
    body: "Sekarang cari lowongan untuk diukur. Paling cepat dari LinkedIn: buka hasil pencarian, satu lowongan, atau postingan rekrutmen, tekan Ctrl+A lalu Ctrl+C, lalu klik salah satu kartu ini.",
    place: "bottom",
  },
  {
    route: "/leads",
    target: '[data-tour="composer"]',
    chapter: 1,
    title: "Tempel, lalu kirim",
    demo: DemoPaste,
    body: "Teks menu dan iklan ikut tersalin tidak masalah. Isi Fokus pencarian sekali (misalnya DevOps, Jabodetabek), lalu tekan tombol panah. Benang langsung mengukurnya.",
    place: "bottom",
  },
  {
    route: "/leads",
    target: '[data-tour="results"]',
    chapter: 1,
    title: "Lowongan sudah diukur",
    demo: DemoResults,
    body: "Tiap lowongan diukur: skor kecocokan, ukuran perusahaan, dan tanda bahaya seperti biaya rekrutmen. Yang cocok dijadikan lamaran, lalu CV-mu disesuaikan untuknya.",
    place: "top",
  },
  {
    route: "/applications",
    target: '[data-tour="app-list"]',
    chapter: 2,
    title: "CV-mu disesuaikan per lowongan",
    demo: DemoConfirm,
    body: "Buka satu lamaran. CV default dari Bahan CV-mu diaransemen ulang untuk lowongan itu. Kalau lowongan minta sesuatu yang belum jelas di bahanmu, Benang tanya dulu: \"Kamu pernah X?\" Yang kamu jawab belum, tidak diklaim. Setelah itu CV dijahit: unduh PDF, lalu tulis email di tab Email.",
    place: "top",
  },
  {
    route: "/applications",
    target: '[data-tour="stats"]',
    title: "Semua lamaranmu di satu tempat",
    demo: DemoStats,
    body: "Persen besar di atas halaman Lamaran adalah rata-rata seberapa cocok kamu dengan lowongan yang sudah diukur. Makin tinggi, makin pas. Di bawahnya ada hitungan tiap tahap: diukur, dijahit, dikirim, sampai interview. Lowongan dari luar LinkedIn bisa diukur lewat tombol Ukur lowongan baru.",
    place: "bottom",
  },
  {
    route: "/forms",
    target: '[data-tour="forms"]',
    chapter: 3,
    title: "Form HR",
    demo: DemoForm,
    body: "Dapat form data diri .docx dari HR? Unggah di sini. Benang mengisi yang sudah dia tahu, menanyakan sisanya lewat obrolan, lalu mencatatnya untuk form berikutnya.",
    place: "bottom",
  },
  {
    route: "/forms?tab=data",
    target: '[data-tour="signature"]',
    chapter: 3,
    title: "Buku catatan Benang",
    demo: DemoSign,
    body: "Semua yang Benang ingat untuk form ada di sini. Gambar tanda tanganmu sekali, Benang menempelnya di setiap form.",
    place: "right",
  },
  {
    target: '[data-tour="provider"]',
    title: "Sambungkan AI",
    demo: DemoProvider,
    body: "Tambahkan API key (Claude, OpenAI, Gemini, atau lainnya) di Provider AI. Kalau satu gagal, aplikasi otomatis pindah ke yang berikutnya.",
    place: "bottom",
  },
  {
    title: "Siap dijahit",
    body: "Mulai dengan mengukur satu lowongan: tempel halamannya di Lowongan, Benang yang menjahit sisanya. Tur ini bisa dibuka lagi dari tombol tanda tanya di sidebar.",
  },
];

// The tour opens on every visit until the user ticks "Jangan tampilkan lagi".
const HIDE_KEY = "cv-tailor:tour-hidden";
const PAD = 8;

export function tourHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return true;
  }
}
function setHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(HIDE_KEY, "1");
    else localStorage.removeItem(HIDE_KEY);
  } catch {
    /* storage blocked: the tour simply shows again next time */
  }
}

type Rect = { x: number; y: number; w: number; h: number };

// The mascot sits at the card's lower left; aim its arm at the spotlight.
function pointAt(target: Rect, card: Rect): MascotPose {
  const dx = target.x + target.w / 2 - (card.x + 50);
  const dy = target.y + target.h / 2 - (card.y + card.h - 60);
  if (Math.abs(dx) > Math.abs(dy) * 1.2) return dx < 0 ? "point-left" : "point-right";
  return dy < 0 ? "point-up" : "point-down";
}

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(null);
  const [pose, setPose] = useState<MascotPose>("wave");
  const card = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const [hide, setHide] = useState(tourHidden);
  const close = useCallback(() => {
    setHidden(hide);
    onClose();
  }, [onClose, hide]);

  // Go to the step's page.
  useEffect(() => {
    // routes may carry a query (Form HR tabs), so compare the whole location
    if (step.route && location.pathname + location.search !== step.route) navigate(step.route);
  }, [i]);

  // Find the target (it may appear a moment after navigation) and keep tracking it.
  useLayoutEffect(() => {
    let raf = 0;
    let tries = 0;
    const measure = () => {
      const el = step.target ? (document.querySelector(step.target) as HTMLElement | null) : null;
      const visible = el && el.getBoundingClientRect().width > 0;
      if (!visible && step.target && tries++ < 40) {
        raf = requestAnimationFrame(measure);
        return;
      }
      if (!visible) {
        setRect(null);
        return;
      }
      el!.scrollIntoView({ block: "center", behavior: "smooth" });
      const update = () => {
        const r = el!.getBoundingClientRect();
        setRect({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
      };
      update();
      const onMove = () => update();
      window.addEventListener("scroll", onMove, true);
      window.addEventListener("resize", onMove);
      const settle = setInterval(update, 120);
      setTimeout(() => clearInterval(settle), 900);
      cleanup = () => {
        window.removeEventListener("scroll", onMove, true);
        window.removeEventListener("resize", onMove);
        clearInterval(settle);
      };
    };
    let cleanup = () => {};
    measure();
    return () => {
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [i, location.pathname, location.search]);

  // Place the card next to the spotlight, inside the viewport.
  useLayoutEffect(() => {
    const c = card.current;
    if (!c) return;
    const cw = c.offsetWidth;
    const ch = c.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect || vw < 700) {
      if (!rect) {
        setPose(last ? "cheer" : "wave");
        setCardPos(null);
        return;
      }
      const pos = { left: (vw - cw) / 2, top: rect.y + rect.h + 14 + ch < vh ? rect.y + rect.h + 14 : Math.max(12, rect.y - ch - 14) };
      setCardPos(pos);
      setPose(pointAt(rect, { x: pos.left, y: pos.top, w: cw, h: ch }));
      return;
    }
    const gap = 16;
    let left = rect.x + rect.w / 2 - cw / 2;
    let top = rect.y + rect.h + gap;
    if (step.place === "top") top = rect.y - ch - gap;
    if (step.place === "right") {
      left = rect.x + rect.w + gap;
      top = rect.y + rect.h / 2 - ch / 2;
    }
    if (step.place === "left") {
      left = rect.x - cw - gap;
      top = rect.y + rect.h / 2 - ch / 2;
    }
    if (top + ch > vh - 12) top = rect.y - ch - gap;
    if (top < 12) top = Math.min(vh - ch - 12, rect.y + rect.h + gap);
    left = Math.max(12, Math.min(vw - cw - 12, left));
    top = Math.max(12, Math.min(vh - ch - 12, top));
    setCardPos({ left, top });
    setPose(pointAt(rect, { x: left, y: top, w: cw, h: ch }));
  }, [rect, i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" || e.key === "Enter") last ? close() : setI((n) => n + 1);
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, close]);

  const centered = !rect;
  const Demo = step.demo;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tur aplikasi">
      <div
        className={`tour-spot${centered ? " none" : ""}`}
        style={rect ? { transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.w, height: rect.h } : undefined}
      />
      <div className="tour-catch" onClick={close} />
      <div
        ref={card}
        className={`tour-card${centered ? " centered" : ""}`}
        style={!centered && cardPos ? { left: cardPos.left, top: cardPos.top } : undefined}
      >
        {centered && (
          <div className="tour-hero">
            <Mascot size={150} pose={last ? "cheer" : "wave"} />
          </div>
        )}
        {Demo && (
          <div className="tour-stage" key={`d${i}`}>
            <Demo />
          </div>
        )}
        <div className="tour-text" key={`t${i}`}>
          {!centered && (
            <div className="tour-guide">
              <Mascot size={92} pose={pose} />
            </div>
          )}
          <div>
            <div className="tour-step">
              <span className="tour-chapter">{step.chapter != null ? `Langkah ${step.chapter + 1} · ${CHAPTERS[step.chapter]}` : ""}</span>{" "}
              <span className="tour-count">
                {i + 1}/{STEPS.length}
              </span>
            </div>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </div>
        </div>
        <div className="tour-progress" aria-hidden>
          <i style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
        </div>
        <label className="tour-hide">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
          Jangan tampilkan lagi
        </label>
        <div className="tour-actions">
          {i === 0 ? (
            <button className="btn ghost sm" onClick={close}>
              Lewati
            </button>
          ) : (
            <button className="btn ghost sm" onClick={() => setI(i - 1)}>
              <ArrowLeft size={14} /> Kembali
            </button>
          )}
          <button className="btn primary sm" onClick={() => (last ? close() : setI(i + 1))} autoFocus>
            {last ? "Mulai pakai" : i === 0 ? "Mulai tur" : "Lanjut"} {!last && <ArrowRight size={14} />}
          </button>
        </div>
        <button className="icon-btn tour-x" onClick={close} aria-label="Tutup tur">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
