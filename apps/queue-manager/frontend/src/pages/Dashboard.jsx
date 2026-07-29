import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

const todayISO = () => new Date().toISOString().slice(0, 10);
const STATUT_LABELS = {
  WAITING: 'En attente',
  ADMISSION: 'Formalités',
  CALLED: 'Appelés',
  IN_PROGRESS: 'En examen',
  COMPLETED: 'Terminés',
  ABSENT: 'Absents',
};
const STATUT_BADGE = {
  WAITING: 'bg-slate-100 text-slate-600',
  ADMISSION: 'bg-amber-100 text-amber-700',
  CALLED: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  ABSENT: 'bg-red-100 text-red-700',
};

export default function Dashboard() {
  const [date, setDate] = useState(todayISO());
  const [stats, setStats] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', telephone: '', examen: '',
    heureConvocation: '', poste: '', dureeMinutes: '120',
  });
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('korintek_user') || 'null');

  async function loadData() {
    const [statsRes, listRes] = await Promise.all([
      apiClient.get('/candidates/stats', { params: { date } }),
      apiClient.get('/candidates', { params: { date } }),
    ]);
    setStats(statsRes.data.stats);
    setCandidates(listRes.data.candidates);
  }

  useEffect(() => {
    loadData();
    // Rafraîchissement périodique : nécessaire pour voir apparaître les passages
    // automatiques en statut "Formalités" (T-15min) sans recharger la page.
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [date]);

  function logout() {
    localStorage.removeItem('korintek_token');
    localStorage.removeItem('korintek_user');
    navigate('/login');
  }

  async function handleAddCandidate(e) {
    e.preventDefault();
    await apiClient.post('/candidates', { ...form, datePassage: date });
    setForm({ nom: '', prenom: '', email: '', telephone: '', examen: '', heureConvocation: '', poste: '', dureeMinutes: '120' });
    setShowForm(false);
    loadData();
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    setImportMsg('');
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('datePassage', date);
      const { data } = await apiClient.post('/import/candidates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportMsg(`${data.importes} candidat(s) importé(s)${data.erreurs.length ? `, ${data.erreurs.length} ligne(s) en erreur` : ''}.`);
      loadData();
    } catch (err) {
      setImportMsg(err.response?.data?.error || "Erreur d'import.");
    } finally {
      setImporting(false);
    }
  }

  const cards = [
    { key: 'total', label: 'Total', color: 'bg-slate-100 text-slate-700' },
    { key: 'WAITING', label: 'En attente', color: 'bg-slate-100 text-slate-600' },
    { key: 'ADMISSION', label: 'Formalités', color: 'bg-amber-50 text-amber-700' },
    { key: 'CALLED', label: 'Appelés', color: 'bg-sky-50 text-sky-700' },
    { key: 'COMPLETED', label: 'Terminés', color: 'bg-emerald-50 text-emerald-700' },
    { key: 'ABSENT', label: 'Absents', color: 'bg-red-50 text-red-700' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <div>
            <h1 className="font-heading font-bold text-korintek-ink">Tableau de bord</h1>
            <p className="text-xs text-slate-400">{user?.prenom} {user?.nom} · {user?.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
            <button
              onClick={() => navigate('/ads')}
              className="text-sm text-korintek-tealDark hover:underline"
            >
              Publicités
            </button>
          )}
          {user?.role === 'SUPER_ADMIN' && (
            <button
              onClick={() => navigate('/users')}
              className="text-sm text-korintek-tealDark hover:underline"
            >
              Utilisateurs
            </button>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-korintek-teal/40 focus:border-korintek-teal"
          />
          <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-700">Déconnexion</button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {cards.map((c) => (
            <div key={c.key} className={`rounded-xl p-4 shadow-card ${c.color}`}>
              <p className="text-2xl font-bold">{stats ? stats[c.key] : '—'}</p>
              <p className="text-xs font-medium mt-1">{c.label}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            + Ajouter candidat
          </button>
          <label className="bg-white border border-slate-300 text-sm font-medium rounded-lg px-4 py-2 cursor-pointer hover:bg-slate-100">
            Importer Excel/CSV
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setImportFile(e.target.files[0])} />
          </label>
          {importFile && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-slate-800 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-60"
            >
              {importing ? 'Import en cours...' : `Importer "${importFile.name}"`}
            </button>
          )}
        </section>
        {importMsg && <p className="text-sm text-slate-600">{importMsg}</p>}

        {showForm && (
          <form onSubmit={handleAddCandidate} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-4 gap-3">
            {['nom', 'prenom', 'email', 'telephone', 'examen'].map((field) => (
              <input
                key={field}
                required={['nom', 'prenom', 'examen'].includes(field)}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            ))}
            <input
              type="text"
              placeholder="Poste (ex: Poste 1)"
              value={form.poste}
              onChange={(e) => setForm({ ...form, poste: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2 items-center">
              <input
                type="time"
                required
                value={form.heureConvocation}
                onChange={(e) => setForm({ ...form, heureConvocation: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm flex-1"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">début examen</span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="15"
                step="5"
                placeholder="120"
                value={form.dureeMinutes}
                onChange={(e) => setForm({ ...form, dureeMinutes: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-20"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">min. durée</span>
            </div>
            <button type="submit" className="md:col-span-4 bg-korintek-teal text-white rounded-lg py-2 font-medium text-sm">
              Enregistrer le candidat
            </button>
          </form>
        )}

        <section className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Candidat</th>
                <th className="px-4 py-2">Examen</th>
                <th className="px-4 py-2">Poste</th>
                <th className="px-4 py-2">Heure</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Retard</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono font-medium">{c.numero}</td>
                  <td className="px-4 py-2">{c.prenom} {c.nom}</td>
                  <td className="px-4 py-2">{c.examen}</td>
                  <td className="px-4 py-2 text-slate-500">{c.poste || '—'}</td>
                  <td className="px-4 py-2">{c.heureConvocation}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUT_BADGE[c.statut]}`}>
                      {STATUT_LABELS[c.statut]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {c.retardMinutes > 0 ? (
                      <span className={`text-xs font-semibold ${c.retardMinutes > 15 ? 'text-red-600' : 'text-amber-600'}`}>
                        +{c.retardMinutes} min
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!candidates.length && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Aucun candidat pour cette date.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
