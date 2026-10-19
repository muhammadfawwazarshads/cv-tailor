import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Brand, useAuth } from "../App";
import { api, type User } from "../api";
import { Mascot, type MascotPose } from "../components/Mascot";
import { ErrorBox, Field, Spinner, useAction } from "../components/ui";

export function AuthPage() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [cfg, setCfg] = useState<{ allowRegistration: boolean; hasUsers: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [focus, setFocus] = useState<"name" | "email" | "password" | null>(null);
  const [mood, setMood] = useState<"sad" | "cheer" | null>(null);
  const [shake, setShake] = useState(false);
  const { busy, error, run, setError } = useAction();

  useEffect(() => {
    api("GET", "/api/auth/config").then((c) => {
      setCfg(c);
      if (!c.hasUsers) setMode("register");
    });
  }, []);

  // A failed attempt: Jahit looks sad for a moment and the card gives a small shake.
  useEffect(() => {
    if (!error) return;
    setMood("sad");
    setShake(true);
    const t1 = setTimeout(() => setShake(false), 450);
    const t2 = setTimeout(() => setMood(null), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [error]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => api<{ user: User }>("POST", `/api/auth/${mode}`, { email, password, ...(mode === "register" ? { name } : {}) }));
    if (!r) return;
    setMood("cheer");
    await new Promise((res) => setTimeout(res, 600));
    setUser(r.user);
  }

  // Jahit reacts to the form: reads along while you type, covers its eyes for the password.
  const typed = focus === "email" ? email : focus === "name" ? name : "";
  const pose: MascotPose =
    mood === "cheer" ? "cheer" : mood === "sad" ? "sad" : busy ? "point-up" : focus === "password" && !showPw ? "shy" : focus ? "idle" : "wave";
  const look: [number, number] | undefined =
    focus === "email" || focus === "name" ? [Math.min(1, -0.8 + typed.length / 16), 0.9] : focus === "password" ? [0.2, 0.9] : undefined;

  return (
    <div className="signin">
      <div className="aurora" aria-hidden />
      <header className="signin-top">
        <Brand />
      </header>
      <main className="signin-main">
        <div className="signin-perch">
          <Mascot size={128} pose={pose} look={look} />
        </div>
        <div className={`signin-card${shake ? " shake" : ""}`}>
          <h1>{mode === "login" ? "Masuk" : "Buat akun"}</h1>
          <p className="muted">
            {cfg && !cfg.hasUsers ? "Akun pertama otomatis menjadi admin." : mode === "login" ? "Lanjutkan lamaranmu." : "Cukup nama, email, dan password."}
          </p>
          <form className="stack" onSubmit={submit}>
            {mode === "register" && (
              <Field label="Nama">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setFocus("name")} onBlur={() => setFocus(null)} autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocus("email")}
                onBlur={() => setFocus(null)}
                autoComplete="email"
              />
            </Field>
            <Field label="Password" hint={mode === "register" ? "Minimal 8 karakter." : undefined}>
              <div className="pw-wrap">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={mode === "register" ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocus("password")}
                  onBlur={() => setFocus(null)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  className="pw-eye"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <ErrorBox error={error} />
            <button className="btn primary block signin-submit" disabled={busy || mood === "cheer"}>
              {busy && <Spinner />}
              {mode === "login" ? "Masuk" : "Buat akun"}
            </button>
          </form>
          {cfg?.allowRegistration && cfg.hasUsers && (
            <p className="signin-switch">
              {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setError(null);
                  setMode(mode === "login" ? "register" : "login");
                }}
              >
                {mode === "login" ? "Buat akun" : "Masuk"}
              </a>
            </p>
          )}
        </div>
        <p className="signin-foot">Tempel lowongan, dapat CV yang pas. Ditulis dari pengalamanmu sendiri, tanpa mengarang.</p>
      </main>
    </div>
  );
}
