import { Activity, Briefcase, Cpu, FileSignature, IdCard, LogOut, Menu, Radar, Scissors, UserRound, Users } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api, STANDALONE, type User } from "./api";
import { Loading } from "./components/ui";
import { ProvidersPage } from "./pages/admin/ProvidersPage";
import { UsagePage } from "./pages/admin/UsagePage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ApplicationPage } from "./pages/ApplicationPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { AuthPage } from "./pages/AuthPage";
import { FormsPage } from "./pages/FormsPage";
import { LeadsPage } from "./pages/LeadsPage";
import { PersonalPage } from "./pages/PersonalPage";
import { ProfilePage } from "./pages/ProfilePage";

type AuthCtx = { user: User | null; setUser: (u: User | null) => void };
const Ctx = createContext<AuthCtx>({ user: null, setUser: () => {} });
export const useAuth = () => useContext(Ctx);

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Scissors size={16} strokeWidth={2.5} />
      </div>
      CV Tailor
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User | null }>("GET", "/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <Ctx.Provider value={{ user, setUser }}>
      {!user ? (
        <Routes>
          <Route path="*" element={<AuthPage />} />
        </Routes>
      ) : (
        <Shell />
      )}
    </Ctx.Provider>
  );
}

function Shell() {
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  async function logout() {
    await api("POST", "/api/auth/logout").catch(() => {});
    setUser(null);
  }

  const isAdmin = user!.role === "admin";

  return (
    <div className="shell">
      <div className="aurora" aria-hidden />
      <aside className={`sidebar${open ? " open" : ""}`}>
        <Brand />
        <nav className="nav">
          <NavLink to="/leads">
            <span className="ico violet"><Radar size={16} strokeWidth={2.2} /></span> Lowongan
          </NavLink>
          <NavLink to="/applications">
            <span className="ico sky"><Briefcase size={16} strokeWidth={2.2} /></span> Lamaran
          </NavLink>
          <NavLink to="/forms">
            <span className="ico coral"><FileSignature size={16} strokeWidth={2.2} /></span> Isi form
          </NavLink>
          <NavLink to="/profile">
            <span className="ico mint"><UserRound size={16} strokeWidth={2.2} /></span> Profil CV
          </NavLink>
          <NavLink to="/personal">
            <span className="ico amber"><IdCard size={16} strokeWidth={2.2} /></span> Data pribadi
          </NavLink>
          {isAdmin && (
            <>
              <div className="nav-label">{STANDALONE ? "Pengaturan" : "Pengaturan admin"}</div>
              <NavLink to="/admin/providers">
                <span className="ico slate"><Cpu size={16} strokeWidth={2.2} /></span> Provider AI
              </NavLink>
              <NavLink to="/admin/usage">
                <span className="ico slate"><Activity size={16} strokeWidth={2.2} /></span> Pemakaian AI
              </NavLink>
              {!STANDALONE && (
                <NavLink to="/admin/users">
                  <span className="ico slate"><Users size={16} strokeWidth={2.2} /></span> Pengguna
                </NavLink>
              )}
            </>
          )}
        </nav>
        <div className="me">
          <div className="avatar">{(user!.name || user!.email).slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="who">{user!.name}</div>
            <div className="sub">{STANDALONE ? "Data tersimpan di browser ini" : isAdmin ? "Admin" : user!.email}</div>
          </div>
          {!STANDALONE && (
            <button className="icon-btn" onClick={logout} aria-label="Keluar" title="Keluar">
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>
      <div>
        <div className="mobile-bar">
          <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Buka menu">
            <Menu size={20} />
          </button>
          CV Tailor
        </div>
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/applications" replace />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/:id" element={<ApplicationPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/forms" element={<FormsPage />} />
            <Route path="/personal" element={<PersonalPage />} />
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
