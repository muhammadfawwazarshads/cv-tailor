import { Activity, Briefcase, Cpu, LogOut, Menu, Scissors, UserRound, Users } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api, type User } from "./api";
import { Loading } from "./components/ui";
import { ProvidersPage } from "./pages/admin/ProvidersPage";
import { UsagePage } from "./pages/admin/UsagePage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ApplicationPage } from "./pages/ApplicationPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { AuthPage } from "./pages/AuthPage";
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
      <aside className={`sidebar${open ? " open" : ""}`}>
        <Brand />
        <nav className="nav">
          <NavLink to="/applications">
            <Briefcase size={18} /> Lamaran
          </NavLink>
          <NavLink to="/profile">
            <UserRound size={18} /> Profil CV
          </NavLink>
          {isAdmin && (
            <>
              <div className="nav-label">Pengaturan admin</div>
              <NavLink to="/admin/providers">
                <Cpu size={18} /> Provider AI
              </NavLink>
              <NavLink to="/admin/usage">
                <Activity size={18} /> Pemakaian AI
              </NavLink>
              <NavLink to="/admin/users">
                <Users size={18} /> Pengguna
              </NavLink>
            </>
          )}
        </nav>
        <div className="me">
          <div className="avatar">{(user!.name || user!.email).slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="who">{user!.name}</div>
            <div className="sub">{isAdmin ? "Admin" : user!.email}</div>
          </div>
          <button className="icon-btn" onClick={logout} aria-label="Keluar" title="Keluar">
            <LogOut size={17} />
          </button>
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
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/:id" element={<ApplicationPage />} />
            <Route path="/profile" element={<ProfilePage />} />
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
