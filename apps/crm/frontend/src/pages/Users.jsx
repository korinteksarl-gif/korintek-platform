import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

const ROLE_LABELS = {
  PENDING: 'En attente',
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  SALES: 'Commercial',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  async function load() {
    const { data } = await apiClient.get('/users');
    setUsers(data.users);
  }

  useEffect(() => { load(); }, []);

  async function updateRole(id, role) {
    await apiClient.put(`/users/${id}`, { role });
    load();
  }

  async function toggleActive(u) {
    await apiClient.put(`/users/${u.id}`, { active: !u.active });
    load();
  }

  return (
    <div className="min-h-screen page-bg">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <h1 className="font-heading font-bold text-korintek-ink">Utilisateurs</h1>
        </div>
        <button onClick={() => navigate('/pipeline')} className="text-sm text-korintek-tealDark hover:underline">← Pipeline</button>
      </header>

      <main className="p-6 max-w-3xl mx-auto">
        <section className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Rôle</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{u.prenom} {u.nom}</td>
                  <td className="px-4 py-2 text-slate-500">{u.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="text-xs rounded-lg border border-slate-300 px-2 py-1"
                    >
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`text-xs font-medium rounded-full px-3 py-1 ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {u.active ? 'Actif' : 'Désactivé'}
                    </button>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Aucun utilisateur.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
