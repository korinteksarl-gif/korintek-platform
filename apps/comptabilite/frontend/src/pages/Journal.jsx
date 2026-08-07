import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

const EMPTY_LINE = { accountId: '', debit: '', credit: '', label: '' };

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

export default function Journal() {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '' });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('korintek_compta_user') || 'null');

  async function load() {
    const [entriesRes, accountsRes] = await Promise.all([
      apiClient.get('/journal'),
      apiClient.get('/accounts', { params: { active: 'true' } }),
    ]);
    setEntries(entriesRes.data.entries);
    setAccounts(accountsRes.data.accounts);
  }

  useEffect(() => { load(); }, []);

  function logout() {
    localStorage.removeItem('korintek_compta_token');
    localStorage.removeItem('korintek_compta_user');
    navigate('/login');
  }

  function updateLine(index, field, value) {
    const next = [...lines];
    next[index] = { ...next[index], [field]: value };
    // Une ligne ne peut avoir que débit OU crédit — vider l'autre automatiquement
    if (field === 'debit' && value) next[index].credit = '';
    if (field === 'credit' && value) next[index].debit = '';
    setLines(next);
  }

  function addLine() {
    setLines([...lines, { ...EMPTY_LINE }]);
  }

  function removeLine(index) {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!isBalanced) {
      setFormError(`Écriture déséquilibrée : débit ${fmt(totalDebit)} ≠ crédit ${fmt(totalCredit)} FCFA.`);
      return;
    }
    try {
      await apiClient.post('/journal', {
        ...form,
        lines: lines.filter((l) => l.accountId && (Number(l.debit) || Number(l.credit))),
      });
      setForm({ date: new Date().toISOString().slice(0, 10), description: '' });
      setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erreur lors de la création de l\'écriture.');
    }
  }

  async function removeEntry(id) {
    if (!confirm('Supprimer cette écriture ? Cette action est irréversible.')) return;
    await apiClient.delete(`/journal/${id}`);
    load();
  }

  return (
    <div className="min-h-screen page-bg">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <div>
            <h1 className="font-heading font-bold text-korintek-ink">Journal comptable</h1>
            <p className="text-xs text-slate-400">{user?.prenom} {user?.nom} · {user?.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/comptes')} className="text-sm text-korintek-tealDark hover:underline">Plan comptable</button>
          <button onClick={() => navigate('/rapports')} className="text-sm text-korintek-tealDark hover:underline">Rapports</button>
          {user?.role === 'SUPER_ADMIN' && (
            <button onClick={() => navigate('/users')} className="text-sm text-korintek-tealDark hover:underline">Utilisateurs</button>
          )}
          <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-700">Déconnexion</button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          + Nouvelle écriture
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Description de l'écriture"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    value={line.accountId}
                    onChange={(e) => updateLine(i, 'accountId', e.target.value)}
                    className="col-span-5 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    <option value="">Compte...</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Débit"
                    value={line.debit}
                    onChange={(e) => updateLine(i, 'debit', e.target.value)}
                    className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs num-cell"
                  />
                  <input
                    type="number"
                    placeholder="Crédit"
                    value={line.credit}
                    onChange={(e) => updateLine(i, 'credit', e.target.value)}
                    className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs num-cell"
                  />
                  <input
                    placeholder="Note (optionnel)"
                    value={line.label}
                    onChange={(e) => updateLine(i, 'label', e.target.value)}
                    className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 2}
                    className="col-span-1 text-red-400 hover:text-red-600 disabled:opacity-30 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={addLine} className="text-xs text-korintek-tealDark hover:underline">
              + Ajouter une ligne
            </button>

            <div className={`flex justify-between items-center rounded-lg px-4 py-2 text-sm font-medium ${isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <span>Total débit : {fmt(totalDebit)} FCFA</span>
              <span>Total crédit : {fmt(totalCredit)} FCFA</span>
              <span>{isBalanced ? '✓ Équilibrée' : 'Déséquilibrée'}</span>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <button type="submit" className="w-full bg-korintek-navy text-white rounded-lg py-2 font-medium text-sm">
              Enregistrer l'écriture
            </button>
          </form>
        )}

        <section className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Référence</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Lignes</th>
                <th className="px-4 py-2 text-right">Montant</th>
                {user?.role === 'SUPER_ADMIN' && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const total = entry.lines.reduce((s, l) => s + l.debit, 0);
                return (
                  <tr key={entry.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{entry.reference}</td>
                    <td className="px-4 py-2 text-slate-500">{new Date(entry.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2">{entry.description}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {entry.lines.map((l) => (
                        <div key={l.id}>
                          {l.account.code} {l.debit > 0 ? `D ${fmt(l.debit)}` : `C ${fmt(l.credit)}`}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-2 text-right num-cell font-medium">{fmt(total)} FCFA</td>
                    {user?.role === 'SUPER_ADMIN' && (
                      <td className="px-4 py-2">
                        <button onClick={() => removeEntry(entry.id)} className="text-red-500 hover:text-red-700 text-xs">Supprimer</button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!entries.length && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucune écriture.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
