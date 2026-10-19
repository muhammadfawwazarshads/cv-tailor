import { UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../App";
import { api, formatDate } from "../../api";
import { ErrorBox, Field, Loading, Spinner, useAction } from "../../components/ui";

type Row = { id: string; email: string; name: string; role: "admin" | "user"; created_at: string; applications: number };

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Row[] | null>(null);
  const act = useAction();
  const [adding, setAdding] = useState(false);

  const refresh = async () => setUsers((await api("GET", "/api/admin/users")).users);
  useEffect(() => {
    act.run(refresh);
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pengguna</h1>
          <p>Admin bisa mengatur provider AI dan melihat pemakaian. Data CV dan lamaran tiap pengguna tetap privat.</p>
        </div>
        {!adding && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Tambah pengguna
          </button>
        )}
      </div>
      {adding && (
        <AddUser
          onDone={async () => {
            setAdding(false);
            await refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      <ErrorBox error={act.error} />
      {!users ? (
        <Loading />
      ) : (
        <div className="card flush">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th className="num">Lamaran</th>
                  <th>Bergabung</th>
                  <th>Peran</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                    </td>
                    <td>{u.email}</td>
                    <td className="num">{u.applications}</td>
                    <td className="small muted">{formatDate(u.created_at)}</td>
                    <td>
                      <select
                        value={u.role}
                        disabled={u.id === user?.id}
                        style={{ width: "auto" }}
                        aria-label={`Peran ${u.email}`}
                        onChange={(e) =>
                          act.run(async () => {
                            await api("PATCH", `/api/admin/users/${u.id}`, { role: e.target.value });
                            await refresh();
                          })
                        }
                      >
                        <option value="user">Pengguna</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/** Create an account for someone; they sign in with this password (tell them to keep it private). */
function AddUser({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const act = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await act.run(() => api("POST", "/api/admin/users", { name, email, password, role }));
    if (r) onDone();
  }

  return (
    <form className="card stack" style={{ marginBottom: 16 }} onSubmit={submit}>
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Tambah pengguna</h2>
          <p>Berguna saat pendaftaran umum ditutup. Berikan email dan password ini ke orangnya.</p>
        </div>
      </div>
      <div className="grid-2">
        <Field label="Nama">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Password awal" hint="Minimal 8 karakter.">
          <input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Peran">
          <select value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")}>
            <option value="user">Pengguna</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
      </div>
      <ErrorBox error={act.error} />
      <div className="row">
        <button className="btn primary" disabled={act.busy}>
          {act.busy && <Spinner />} Buat akun
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}
