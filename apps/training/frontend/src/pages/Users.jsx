import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

const ROLES = ['PENDING', 'SUPER_ADMIN', 'ADMIN', 'TRAINER', 'FINANCE'];
const ROLE_LABELS = {
  PENDING: "En attente d'attribution",
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  TRAINER: 'Formateur',
  FINANCE: 'Finance',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(null);
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('korintek_training_user') || 'null');

  async function load() {
    const { data } = await apiClient.get('/users');
    setUsers(data.users);
  }

  useEffect(() => { load(); }, []);

  async function updateRole(id, role) {
    setSaving(id);
    try {
      await apiClient.put(`/users/${id}/role`, { role });
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(id, active) {
    setSaving(id);
    try {
      await apiClient.put(`/users/${id}/active`, { active: !active });
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function removeUser(id, email) {
    if (!window.confirm(`Supprimer définitivement le compte ${email} ?`)) return;
    setSaving(id);
    try {
      await apiClient.delete(`/users/${id}`);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <div>
            <h1 className="font-heading font-bold text-korintek-ink">Utilisateurs</h1>
            <p className="text-xs text-slate-400">Attribution des rôles — équipe Training</p>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-sm text-korintek-tealDark hover:underline">
          ← Retour au tableau de bord
        </button>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-slate-500 mb-4">
          Les comptes se créent automatiquement à la première connexion via Microsoft 365,
          avec le rôle "En attente d'attribution". Attribue-leur un rôle ici pour leur
          donner accès aux fonctionnalités correspondantes.
        </p>

        <div className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Utilisateur</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Rôle</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
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
                      disabled={saving === u.id || u.id === currentUser?.id}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleActive(u.id, u.active)}
                      disabled={saving === u.id || u.id === currentUser?.id}
                      className={`text-xs font-medium rounded-full px-3 py-1 ${
                        u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {u.active ? 'Actif' : 'Désactivé'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeUser(u.id, u.email)}
                      disabled={saving === u.id || u.id === currentUser?.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Aucun utilisateur.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
