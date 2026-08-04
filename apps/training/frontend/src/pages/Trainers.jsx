import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

const PAYMENT_MODE_LABELS = {
  HOURLY: 'Taux horaire',
  FLAT_PER_SESSION: 'Forfait par session',
  PERCENTAGE: 'Pourcentage',
};

export default function Trainers() {
  const [trainers, setTrainers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', telephone: '', defaultPaymentMode: 'FLAT_PER_SESSION', defaultRate: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [paymentEdits, setPaymentEdits] = useState({});
  const navigate = useNavigate();

  async function load() {
    const { data } = await apiClient.get('/trainers');
    setTrainers(data.trainers);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    await apiClient.post('/trainers', form);
    setForm({ nom: '', prenom: '', email: '', telephone: '', defaultPaymentMode: 'FLAT_PER_SESSION', defaultRate: '' });
    setShowForm(false);
    load();
  }

  async function toggleActive(trainer) {
    await apiClient.put(`/trainers/${trainer.id}`, { active: !trainer.active });
    load();
  }

  function startEditPayment(session) {
    setPaymentEdits({
      ...paymentEdits,
      [session.id]: {
        paymentAmount: session.paymentAmount ?? '',
        paymentStatus: session.paymentStatus,
        paymentNotes: session.paymentNotes ?? '',
      },
    });
  }

  async function savePayment(sessionId) {
    const edit = paymentEdits[sessionId];
    await apiClient.put(`/trainers/sessions/${sessionId}/payment`, edit);
    setPaymentEdits({ ...paymentEdits, [sessionId]: undefined });
    load();
  }

  function suggestedAmount(trainer, session) {
    if (trainer.defaultPaymentMode === 'HOURLY') {
      return trainer.defaultRate * (session.course?.durationHours || 0);
    }
    if (trainer.defaultPaymentMode === 'FLAT_PER_SESSION') {
      return trainer.defaultRate;
    }
    return null; // pourcentage : calcul manuel, dépend du nombre d'inscrits
  }

  const totalDue = trainers.reduce((sum, t) => {
    const pending = (t.sessions || []).filter((s) => s.paymentStatus === 'PENDING');
    return sum + pending.reduce((s2, sess) => s2 + (sess.paymentAmount || 0), 0);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <h1 className="font-heading font-bold text-korintek-ink">Formateurs</h1>
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-sm text-korintek-tealDark hover:underline">← Inscriptions</button>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {totalDue > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <strong>{totalDue.toLocaleString('fr-FR')} FCFA</strong> restent à payer aux formateurs, toutes sessions confondues.
          </div>
        )}

        <button onClick={() => setShowForm((v) => !v)} className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2">
          + Nouveau formateur
        </button>

        {showForm && (
          <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-2 gap-3">
            <input required placeholder="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input required placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={form.defaultPaymentMode} onChange={(e) => setForm({ ...form, defaultPaymentMode: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {Object.entries(PAYMENT_MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" placeholder="Tarif par défaut (FCFA)" value={form.defaultRate} onChange={(e) => setForm({ ...form, defaultRate: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" className="md:col-span-2 bg-korintek-teal text-white rounded-lg py-2 font-medium text-sm">Enregistrer le formateur</button>
          </form>
        )}

        <div className="space-y-4">
          {trainers.map((t) => {
            const isExpanded = expandedId === t.id;
            const sessions = t.sessions || [];
            return (
              <div key={t.id} className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-heading font-bold text-korintek-ink">{t.prenom} {t.nom}</h2>
                    <p className="text-xs text-slate-400">
                      {PAYMENT_MODE_LABELS[t.defaultPaymentMode]} · {t.defaultRate.toLocaleString('fr-FR')} FCFA
                      {t.email && ` · ${t.email}`}
                      {t.telephone && ` · ${t.telephone}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(t)} className={`text-xs font-medium rounded-full px-3 py-1 ${t.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.active ? 'Actif' : 'Inactif'}
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : t.id)} className="text-xs text-korintek-tealDark hover:underline">
                      {isExpanded ? 'Réduire' : `${sessions.length} session(s)`}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
                    {!sessions.length && <p className="text-xs text-slate-400 italic">Aucune session assignée.</p>}
                    {sessions.map((s) => {
                      const editing = paymentEdits[s.id];
                      return (
                        <div key={s.id} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-medium text-slate-700">{s.course?.title}</span>
                              <span className="text-slate-400 ml-2">{new Date(s.startDate).toLocaleDateString('fr-FR')}</span>
                            </div>
                            <span className={`font-medium rounded-full px-2 py-0.5 ${s.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {s.paymentStatus === 'PAID' ? 'Payé' : 'À payer'}
                            </span>
                          </div>

                          {editing ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                placeholder={`Suggéré : ${suggestedAmount(t, s) ?? '—'}`}
                                value={editing.paymentAmount}
                                onChange={(e) => setPaymentEdits({ ...paymentEdits, [s.id]: { ...editing, paymentAmount: e.target.value } })}
                                className="rounded border border-slate-300 px-2 py-1 text-xs w-32"
                              />
                              <select
                                value={editing.paymentStatus}
                                onChange={(e) => setPaymentEdits({ ...paymentEdits, [s.id]: { ...editing, paymentStatus: e.target.value } })}
                                className="rounded border border-slate-300 px-2 py-1 text-xs"
                              >
                                <option value="PENDING">À payer</option>
                                <option value="PAID">Payé</option>
                              </select>
                              <input
                                placeholder="Note"
                                value={editing.paymentNotes}
                                onChange={(e) => setPaymentEdits({ ...paymentEdits, [s.id]: { ...editing, paymentNotes: e.target.value } })}
                                className="rounded border border-slate-300 px-2 py-1 text-xs flex-1 min-w-[100px]"
                              />
                              <button onClick={() => savePayment(s.id)} className="text-korintek-tealDark font-medium">OK</button>
                              <button onClick={() => setPaymentEdits({ ...paymentEdits, [s.id]: undefined })} className="text-slate-400">Annuler</button>
                            </div>
                          ) : (
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-slate-500">
                                {s.paymentAmount ? `${s.paymentAmount.toLocaleString('fr-FR')} FCFA` : 'Montant non défini'}
                                {s.paymentNotes && ` · ${s.paymentNotes}`}
                              </span>
                              <button onClick={() => startEditPayment(s)} className="text-korintek-tealDark hover:underline">Modifier</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {!trainers.length && <p className="text-sm text-slate-400 text-center py-8">Aucun formateur enregistré.</p>}
        </div>
      </main>
    </div>
  );
}
