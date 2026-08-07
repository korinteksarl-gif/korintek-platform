import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

const TYPE_LABELS = {
  ACTIF: 'Actif',
  PASSIF: 'Passif',
  CAPITAUX_PROPRES: 'Capitaux propres',
  PRODUIT: 'Produit',
  CHARGE: 'Charge',
};

const TYPE_COLORS = {
  ACTIF: 'bg-sky-100 text-sky-700',
  PASSIF: 'bg-amber-100 text-amber-700',
  CAPITAUX_PROPRES: 'bg-indigo-100 text-indigo-700',
  PRODUIT: 'bg-emerald-100 text-emerald-700',
  CHARGE: 'bg-red-100 text-red-700',
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'CHARGE', description: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function load() {
    const { data } = await apiClient.get('/accounts', { params: { active: undefined } });
    setAccounts(data.accounts);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await apiClient.post('/accounts', form);
      setForm({ code: '', name: '', type: 'CHARGE', description: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création du compte.');
    }
  }

  async function toggleActive(account) {
    await apiClient.put(`/accounts/${account.id}`, { active: !account.active });
    load();
  }

  return (
    <div className="min-h-screen page-bg">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <h1 className="font-heading font-bold text-korintek-ink">Plan comptable</h1>
        </div>
        <button onClick={() => navigate('/journal')} className="text-sm text-korintek-tealDark hover:underline">← Journal</button>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          + Nouveau compte
        </button>

        {showForm && (
          <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-2 gap-3">
            <input required placeholder="Code (ex: 601000)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input required placeholder="Nom du compte" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            <input placeholder="Description (optionnel)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <button type="submit" className="md:col-span-2 bg-korintek-teal text-white rounded-lg py-2 font-medium text-sm">Créer le compte</button>
          </form>
        )}

        <section className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{a.code}</td>
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleActive(a)}
                      className={`text-xs font-medium rounded-full px-3 py-1 ${a.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {a.active ? 'Actif' : 'Désactivé'}
                    </button>
                  </td>
                </tr>
              ))}
              {!accounts.length && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Aucun compte.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
