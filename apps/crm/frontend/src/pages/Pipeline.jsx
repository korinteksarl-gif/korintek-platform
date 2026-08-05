import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

const STAGES = [
  { key: 'NOUVEAU', label: 'Nouveau', color: 'bg-slate-100 text-slate-600' },
  { key: 'CONTACTE', label: 'Contacté', color: 'bg-sky-100 text-sky-700' },
  { key: 'PROPOSITION_ENVOYEE', label: 'Proposition envoyée', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'NEGOCIATION', label: 'Négociation', color: 'bg-amber-100 text-amber-700' },
  { key: 'GAGNE', label: 'Gagné', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'PERDU', label: 'Perdu', color: 'bg-red-100 text-red-700' },
];

const TYPE_LABELS = {
  PROSPECT_FORMATION: 'Prospect formation',
  PARTENAIRE_B2B: 'Partenaire B2B',
};

const INTERACTION_LABELS = {
  APPEL: '📞 Appel',
  EMAIL: '✉️ Email',
  REUNION: '🤝 Réunion',
  NOTE: '📝 Note',
};

export default function Pipeline() {
  const [contacts, setContacts] = useState([]);
  const [statsByStage, setStatsByStage] = useState({});
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', entreprise: '', email: '', telephone: '', type: 'PROSPECT_FORMATION', source: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [interactionDraft, setInteractionDraft] = useState({ type: 'NOTE', notes: '' });
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('korintek_crm_user') || 'null');

  async function load() {
    const params = {};
    if (search) params.search = search;
    if (typeFilter) params.type = typeFilter;
    const [contactsRes, statsRes] = await Promise.all([
      apiClient.get('/contacts', { params }),
      apiClient.get('/contacts/stats'),
    ]);
    setContacts(contactsRes.data.contacts);
    setStatsByStage(statsRes.data.byStage);
  }

  useEffect(() => { load(); }, [search, typeFilter]);

  function logout() {
    localStorage.removeItem('korintek_crm_token');
    localStorage.removeItem('korintek_crm_user');
    navigate('/login');
  }

  async function handleAdd(e) {
    e.preventDefault();
    await apiClient.post('/contacts', form);
    setForm({ nom: '', prenom: '', entreprise: '', email: '', telephone: '', type: 'PROSPECT_FORMATION', source: '' });
    setShowForm(false);
    load();
  }

  async function changeStage(contactId, stage) {
    await apiClient.put(`/contacts/${contactId}`, { stage });
    load();
  }

  async function removeContact(contactId) {
    if (!confirm('Supprimer ce contact ?')) return;
    await apiClient.delete(`/contacts/${contactId}`);
    load();
  }

  function startInteraction(contactId) {
    setExpandedId(expandedId === contactId ? null : contactId);
    setInteractionDraft({ type: 'NOTE', notes: '' });
  }

  async function submitInteraction(contactId) {
    if (!interactionDraft.notes.trim()) return;
    await apiClient.post(`/contacts/${contactId}/interactions`, interactionDraft);
    setInteractionDraft({ type: 'NOTE', notes: '' });
    load();
  }

  return (
    <div className="min-h-screen page-bg">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <div>
            <h1 className="font-heading font-bold text-korintek-ink">Pipeline commercial</h1>
            <p className="text-xs text-slate-400">{user?.prenom} {user?.nom} · {user?.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'SUPER_ADMIN' && (
            <button onClick={() => navigate('/users')} className="text-sm text-korintek-tealDark hover:underline">
              Utilisateurs
            </button>
          )}
          <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-700">Déconnexion</button>
        </div>
      </header>

      <main className="p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            + Nouveau contact
          </button>
          <div className="flex items-center gap-2">
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-48"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Tous les types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-3 gap-3">
            <input required placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Entreprise (optionnel)" value={form.entreprise} onChange={(e) => setForm({ ...form, entreprise: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Source (ex: Facebook Ads, bouche à oreille...)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3" />
            <button type="submit" className="md:col-span-3 bg-korintek-teal text-white rounded-lg py-2 font-medium text-sm">Ajouter le contact</button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {STAGES.map((stage) => {
            const stageContacts = contacts.filter((c) => c.stage === stage.key);
            return (
              <div key={stage.key} className="bg-white border border-slate-100 rounded-xl shadow-card flex flex-col min-h-[200px]">
                <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${stage.color}`}>{stage.label}</span>
                  <span className="text-xs text-slate-400">{statsByStage[stage.key] ?? stageContacts.length}</span>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[600px]">
                  {stageContacts.map((c) => {
                    const isExpanded = expandedId === c.id;
                    return (
                      <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                        <div className="flex justify-between items-start gap-1">
                          <div>
                            <p className="font-medium text-slate-700">{c.prenom} {c.nom}</p>
                            {c.entreprise && <p className="text-slate-400">{c.entreprise}</p>}
                            <span className="inline-block mt-1 text-[10px] font-medium text-korintek-tealDark bg-korintek-tealLighter rounded-full px-1.5 py-0.5">
                              {TYPE_LABELS[c.type]}
                            </span>
                          </div>
                          <button onClick={() => removeContact(c.id)} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                        </div>

                        <select
                          value={c.stage}
                          onChange={(e) => changeStage(c.id, e.target.value)}
                          className="mt-2 w-full text-[11px] rounded border border-slate-300 px-1.5 py-1"
                        >
                          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>

                        <button
                          onClick={() => startInteraction(c.id)}
                          className="mt-1.5 text-korintek-tealDark hover:underline text-[11px]"
                        >
                          {isExpanded ? 'Fermer' : `${c.interactions?.length || 0} interaction(s)`}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                            {(c.email || c.telephone) && (
                              <p className="text-slate-500">{c.email}{c.email && c.telephone && ' · '}{c.telephone}</p>
                            )}
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {c.interactions?.map((i) => (
                                <div key={i.id} className="bg-white rounded px-2 py-1 border border-slate-100">
                                  <p className="text-[10px] text-slate-400">
                                    {INTERACTION_LABELS[i.type]} · {new Date(i.createdAt).toLocaleDateString('fr-FR')}
                                  </p>
                                  <p className="text-slate-600">{i.notes}</p>
                                </div>
                              ))}
                              {!c.interactions?.length && <p className="text-slate-400 italic">Aucune interaction.</p>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <select
                                value={interactionDraft.type}
                                onChange={(e) => setInteractionDraft({ ...interactionDraft, type: e.target.value })}
                                className="rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                              >
                                {Object.entries(INTERACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                              <textarea
                                placeholder="Note..."
                                value={interactionDraft.notes}
                                onChange={(e) => setInteractionDraft({ ...interactionDraft, notes: e.target.value })}
                                className="rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                                rows={2}
                              />
                              <button
                                onClick={() => submitInteraction(c.id)}
                                className="bg-korintek-navy text-white rounded py-1 text-[11px] font-medium"
                              >
                                Ajouter
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!stageContacts.length && (
                    <p className="text-[11px] text-slate-300 italic text-center py-4">Vide</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
