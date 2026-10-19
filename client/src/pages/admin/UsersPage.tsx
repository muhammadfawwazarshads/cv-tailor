import { useEffect, useState } from "react";
import { useAuth } from "../../App";
import { api, formatDate } from "../../api";
import { ErrorBox, Loading, useAction } from "../../components/ui";

type Row = { id: string; email: string; name: string; role: "admin" | "user"; created_at: string; applications: number };

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Row[] | null>(null);
  const act = useAction();

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
      </div>
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
