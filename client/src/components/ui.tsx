import { AlertCircle, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SewingLoader } from "./Sewing";

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}

export function Loading() {
  return (
    <div className="center-load">
      <Spinner />
    </div>
  );
}

export function Busy({ children }: { children: ReactNode }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="busy" role="status" aria-live="polite">
      <SewingLoader />
      <div>
        <b>{children}</b>
        <div className="small" style={{ opacity: 0.7 }}>
          Benang lagi menjahit, {secs} detik. Biasanya selesai dalam 20 sampai 90 detik.
        </div>
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <div className="alert error" role="alert">
      <AlertCircle size={17} style={{ marginTop: 1 }} />
      <span>{error}</span>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Runs an async action with busy and error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}

/** Small confirmation in the bottom-right corner that disappears by itself. */
export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 6000);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <div className="toast" role="status">
      <span className="dot" aria-hidden />
      <div>{text}</div>
      <button className="icon-btn" onClick={onDone} aria-label="Tutup">
        <X size={15} />
      </button>
    </div>
  );
}
