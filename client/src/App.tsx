import { Menu } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api, STANDALONE, type User } from "./api";
import { APP_NAME, TAGLINE } from "./brand";
import { Tour, tourHidden } from "./components/Tour";
import { LogoMark } from "./components/Logo";
import { IcBahan, IcForm, IcLamaran, IcLogout, IcLowongan, IcPanel, IcProvider, IcTour, IcUsage, IcUsers } from "./components/NavIcons";
import { Loading } from "./components/ui";
import { Welcome } from "./components/Welcome";
import { ProvidersPage } from "./pages/admin/ProvidersPage";
import { UsagePage } from "./pages/admin/UsagePage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ApplicationPage } from "./pages/ApplicationPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { AuthPage } from "./pages/AuthPage";
import { FormsPage } from "./pages/FormsPage";
import { LeadsPage } from "./pages/LeadsPage";
import { ProfilePage } from "./pages/ProfilePage";

type AuthCtx = { user: User | null; setUser: (u: User | null) => void; welcoming: boolean };
const Ctx = createContext<AuthCtx>({ user: null, setUser: () => {}, welcoming: false });
export const useAuth = () => useContext(Ctx);

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <LogoMark size={34} />
      </div>
      <div className="brand-text">
        <span>{APP_NAME}</span>
        <small>{TAGLINE}</small>
      </div>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [welcoming, setWelcoming] = useState(false);

  useEffect(() => {
    api<{ user: User | null }>("GET", "/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <Ctx.Provider
      value={{
        user,
        // Signing in from the auth page plays the welcome; restoring a session on load does not.
        setUser: (u) => {
          setUser(u);
          setWelcoming(!!u);
        },
        welcoming,
      }}
    >
      {!user ? (
        <Routes>
          <Route path="*" element={<AuthPage />} />
        </Routes>
      ) : (
        <Shell />
      )}
      {user && welcoming && <Welcome name={user.name} onDone={() => setWelcoming(false)} />}
    </Ctx.Provider>
  );
}

const SIDEBAR_KEY = "cv-tailor:sidebar";

function Shell() {
  const { user, setUser, welcoming } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const [tour, setTour] = useState(() => !tourHidden());
  // Desktop sidebar: a slim icon rail by default, or wide with labels; the choice is remembered.
  const [wide, setWide] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "wide";
    } catch {
      return false;
    }
  });
  function toggleWide() {
    setWide((w) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, w ? "rail" : "wide");
      } catch {
        /* storage blocked: the choice lasts for this visit */
      }
      return !w;
    });
  }

  async function logout() {
    await api("POST", "/api/auth/logout").catch(() => {});
    setUser(null);
  }

  const isAdmin = user!.role === "admin";

  return (
    <div className={`shell${wide ? " wide" : ""}`}>
      <div className="aurora" aria-hidden />
      <aside className={`sidebar${open ? " open" : ""}`}>
        <Brand />
        <nav className="nav">
          <NavLink to="/leads">
            <IcLowongan /><span className="lbl">Lowongan</span>
          </NavLink>
          <NavLink to="/applications">
            <IcLamaran /><span className="lbl">Lamaran</span>
          </NavLink>
          <NavLink to="/forms" data-tour="nav-forms">
            <IcForm /><span className="lbl">Form HR</span>
          </NavLink>
          <NavLink to="/profile" data-tour="nav-bahan">
            <IcBahan /><span className="lbl">Bahan CV</span>
          </NavLink>
          {isAdmin && (
            <>
              <div className="nav-label" role="separator" aria-label={STANDALONE ? "Pengaturan" : "Pengaturan admin"} />
              <NavLink to="/admin/providers">
                <IcProvider /><span className="lbl">Provider AI</span>
              </NavLink>
              <NavLink to="/admin/usage">
                <IcUsage /><span className="lbl">Pemakaian AI</span>
              </NavLink>
              {!STANDALONE && (
                <NavLink to="/admin/users">
                  <IcUsers /><span className="lbl">Pengguna</span>
                </NavLink>
              )}
            </>
          )}
        </nav>
        <button className="help-btn" onClick={() => setTour(true)} aria-label="Buka tur aplikasi" title="Tur aplikasi">
          <IcTour />
          <span className="lbl">Tur aplikasi</span>
        </button>
        <button className="help-btn rail-toggle" onClick={toggleWide} aria-label={wide ? "Ciutkan sidebar" : "Lebarkan sidebar"} title={wide ? "Ciutkan" : "Lebarkan"}>
          <IcPanel open={wide} />
          <span className="lbl">{wide ? "Ciutkan" : "Lebarkan"}</span>
        </button>
        <div className="me">
          <div className="avatar">{(user!.name || user!.email).slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="who">{user!.name}</div>
            <div className="sub">{STANDALONE ? "Data tersimpan di browser ini" : isAdmin ? "Admin" : user!.email}</div>
          </div>
          {!STANDALONE && (
            <button className="icon-btn" onClick={logout} aria-label="Keluar" title="Keluar">
              <IcLogout size={18} />
            </button>
          )}
        </div>
      </aside>
      <div>
        <div className="mobile-bar">
          <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Buka menu">
            <Menu size={20} />
          </button>
          <LogoMark size={24} />
          {APP_NAME}
        </div>
        <div className="topbar">
          {user!.role === "admin" && (
            <NavLink to="/admin/providers" className="tb-chip" data-tour="provider">
              <span className="live" aria-hidden /> Provider AI
            </NavLink>
          )}
          <NavLink to="/profile" className="tb-account">
            <span className="avatar sm">{(user!.name || user!.email).slice(0, 1).toUpperCase()}</span>
            {user!.name || "Akun"}
          </NavLink>
        </div>
        {tour && !welcoming && <Tour onClose={() => setTour(false)} />}
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/applications" replace />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/:id" element={<ApplicationPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/forms" element={<FormsPage />} />
            {/* Data diri now lives inside Form HR */}
            <Route path="/personal" element={<Navigate to="/forms?tab=data" replace />} />
            {isAdmin && (
              <>
                <Route path="/admin/providers" element={<ProvidersPage />} />
                <Route path="/admin/usage" element={<UsagePage />} />
                <Route path="/admin/users" element={<UsersPage />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/applications" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
