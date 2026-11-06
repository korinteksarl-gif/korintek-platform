import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

const STATUT_LABELS = {
  PENDING: 'En attente',
  PAYMENT_PARTIAL: 'Acompte versé',
  PAID: 'Payé',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  DROPPED: 'Abandon',
};

const STATUT_BADGE = {
  PENDING: 'bg-slate-100 text-slate-600',
  PAYMENT_PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  DROPPED: 'bg-red-100 text-red-700',
};

const fcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

function normalize(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Export CSV lisible directement par Excel (séparateur « ; », encodage UTF-8 avec BOM)
function exportCsv(rows) {
  const header = ['Date inscription', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Formation', 'Session', 'Statut', 'Montant dû (FCFA)', 'Payé (FCFA)', 'Reste (FCFA)', 'Mode de paiement', 'Via', 'Attestation'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((e) => [
    new Date(e.createdAt).toLocaleDateString('fr-FR'),
    e.student?.prenom,
    e.student?.nom,
    e.student?.email,
    e.student?.telephone,
    e.course?.title,
    e.session?.startDate ? new Date(e.session.startDate).toLocaleDateString('fr-FR') : '',
    STATUT_LABELS[e.statut] || e.statut,
    e.amountDue,
    e.amountPaid,
    Math.max(0, (e.amountDue || 0) - (e.amountPaid || 0)),
    e.paymentMethod || '',
    e.enrolledVia === 'SELF' ? 'En ligne' : 'Équipe',
    e.certificate?.numero || '',
  ].map(esc).join(';'));
  const blob = new Blob(['\ufeff' + [header.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `korintek_inscriptions_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [enrollments, setEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);

  const [showForm, setShowForm] = useState(false);

  // Recherche et filtres (côté navigateur)
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPayment, setFilterPayment] = useState('');

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    courseId: '',
    sessionId: '',
    paymentMethod: '',
    amountPaid: '',
  });

  // ---------------------------------------------------------------------------
  // PAYMENT EDIT
  // ---------------------------------------------------------------------------

  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  // ---------------------------------------------------------------------------
  // STUDENT EDIT
  // ---------------------------------------------------------------------------

  const [editingStudentId, setEditingStudentId] = useState(null);

  const [editStudent, setEditStudent] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
  });

  const [savingStudent, setSavingStudent] = useState(false);

  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem('korintek_training_user') || 'null'
  );

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canSeeMoney = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(user?.role);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return enrollments.filter((e) => {
      if (filterCourse && e.courseId !== filterCourse) return false;
      if (filterStatut && e.statut !== filterStatut) return false;
      const reste = (e.amountDue || 0) - (e.amountPaid || 0);
      if (filterPayment === 'DUE' && !(reste > 0 && e.statut !== 'DROPPED')) return false;
      if (filterPayment === 'SOLDE' && reste > 0) return false;
      if (!q) return true;
      const hay = normalize([e.student?.prenom, e.student?.nom, e.student?.email, e.student?.telephone, e.course?.title, e.certificate?.numero].join(' '));
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [enrollments, search, filterCourse, filterStatut, filterPayment]);

  const stats = useMemo(() => {
    const active = filtered.filter((e) => e.statut !== 'DROPPED');
    const encaisse = filtered.reduce((t, e) => t + (e.amountPaid || 0), 0);
    const reste = active.reduce((t, e) => t + Math.max(0, (e.amountDue || 0) - (e.amountPaid || 0)), 0);
    const attestations = filtered.filter((e) => e.certificate).length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ceMois = filtered.filter((e) => new Date(e.createdAt) >= monthStart).length;
    return { total: filtered.length, actives: active.length, encaisse, reste, attestations, ceMois };
  }, [filtered]);

  const formSessions = (courses.find((c) => c.id === form.courseId)?.sessions) || [];
  const hasFilters = search || filterCourse || filterStatut || filterPayment;

  // ---------------------------------------------------------------------------
  // LOAD
  // ---------------------------------------------------------------------------

  async function load() {
    try {
      const [enrRes, courseRes] = await Promise.all([
        apiClient.get('/enrollments'),
        apiClient.get('/courses'),
      ]);

      setEnrollments(enrRes.data.enrollments || []);
      setCourses(courseRes.data.courses || []);
    } catch (err) {
      console.error('Erreur lors du chargement :', err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ---------------------------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------------------------

  function logout() {
    localStorage.removeItem('korintek_training_token');
    localStorage.removeItem('korintek_training_user');

    navigate('/login');
  }

  // ---------------------------------------------------------------------------
  // ADD ENROLLMENT
  // ---------------------------------------------------------------------------

  async function handleAdd(e) {
    e.preventDefault();

    try {
      await apiClient.post('/enrollments', form);

      setForm({
        nom: '',
        prenom: '',
        email: '',
        telephone: '',
        courseId: '',
        sessionId: '',
        paymentMethod: '',
        amountPaid: '',
      });

      setShowForm(false);

      await load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        "Erreur lors de l'inscription."
      );
    }
  }

  // ---------------------------------------------------------------------------
  // UPDATE STATUS
  // ---------------------------------------------------------------------------

  async function updateStatut(id, statut) {
    try {
      await apiClient.put(
        `/enrollments/${id}`,
        { statut }
      );

      await load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        'Erreur lors de la mise à jour du statut.'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // ISSUE CERTIFICATE
  // ---------------------------------------------------------------------------

  async function issueCertificate(enrollmentId) {
    try {
      await apiClient.post(
        '/certificates/issue',
        { enrollmentId }
      );

      await load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        'Erreur lors de la délivrance.'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // PAYMENT EDIT
  // ---------------------------------------------------------------------------

  function startEditPayment(enrollment) {
    setEditingPaymentId(enrollment.id);
    setEditAmount(String(enrollment.amountPaid ?? 0));
  }

  async function savePayment(id) {
    try {
      await apiClient.put(
        `/enrollments/${id}`,
        {
          amountPaid: Number(editAmount),
        }
      );

      setEditingPaymentId(null);

      await load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        'Erreur lors de la mise à jour du paiement.'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // STUDENT EDIT
  // ---------------------------------------------------------------------------

  function startEditStudent(enrollment) {
    setEditingStudentId(enrollment.id);

    setEditStudent({
      nom: enrollment.student?.nom || '',
      prenom: enrollment.student?.prenom || '',
      email: enrollment.student?.email || '',
      telephone: enrollment.student?.telephone || '',
    });
  }

  function cancelEditStudent() {
    setEditingStudentId(null);

    setEditStudent({
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
    });
  }

  // ---------------------------------------------------------------------------
  // SAVE STUDENT
  // IMPORTANT :
  // Utilise /:id/student et non /:id
  // afin de modifier Student et synchroniser l'attestation.
  // ---------------------------------------------------------------------------

  async function saveStudent(enrollmentId) {
    if (
      !editStudent.nom.trim() ||
      !editStudent.prenom.trim()
    ) {
      alert(
        'Le nom et le prénom sont obligatoires.'
      );

      return;
    }

    const confirmed = window.confirm(
      'Confirmer la correction des informations de cet apprenant ?\n\n' +
      'Si une attestation existe déjà, son nom et son empreinte de sécurité seront automatiquement mis à jour.'
    );

    if (!confirmed) {
      return;
    }

    setSavingStudent(true);

    try {
      // IMPORTANT :
      // Route dédiée à la modification de l'apprenant.
      await apiClient.put(
        `/enrollments/${enrollmentId}/student`,
        {
          nom: editStudent.nom.trim(),
          prenom: editStudent.prenom.trim(),
          email: editStudent.email.trim(),
          telephone: editStudent.telephone.trim(),
        }
      );

      // Fermer le formulaire
      setEditingStudentId(null);

      setEditStudent({
        nom: '',
        prenom: '',
        email: '',
        telephone: '',
      });

      // Recharger depuis la base de données
      // pour afficher immédiatement la nouvelle identité.
      await load();

      alert(
        'Apprenant corrigé avec succès.\n\n' +
        'L’attestation existante a également été synchronisée.'
      );
    } catch (err) {
      console.error(
        'Erreur modification apprenant:',
        err
      );

      alert(
        err.response?.data?.error ||
        "Erreur lors de la correction de l'apprenant."
      );
    } finally {
      setSavingStudent(false);
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen page-bg">

      {/* --------------------------------------------------------------------- */}
      {/* HEADER                                                               */}
      {/* --------------------------------------------------------------------- */}

      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">

        <div className="flex items-center gap-4">

          <Logo
            size={36}
            showWordmark={false}
          />

          <div>
            <h1 className="font-heading font-bold text-korintek-ink">
              Inscriptions
            </h1>

            <p className="text-xs text-slate-400">
              {user?.prenom}{' '}
              {user?.nom}
              {' · '}
              {user?.role}
            </p>
          </div>

        </div>

        <div className="flex items-center gap-3">

          {(user?.role === 'SUPER_ADMIN' ||
            user?.role === 'ADMIN') && (
            <button
              onClick={() =>
                navigate('/formations')
              }
              className="text-sm text-korintek-tealDark hover:underline"
            >
              Formations
            </button>
          )}

          {user?.role === 'SUPER_ADMIN' && (
            <button
              onClick={() =>
                navigate('/users')
              }
              className="text-sm text-korintek-tealDark hover:underline"
            >
              Utilisateurs
            </button>
          )}

          <a
            href="/catalogue"
            className="text-sm text-korintek-tealDark hover:underline"
          >
            Catalogue public
          </a>

          <button
            onClick={logout}
            className="text-sm text-slate-400 hover:text-slate-700"
          >
            Déconnexion
          </button>

        </div>

      </header>

      {/* --------------------------------------------------------------------- */}
      {/* MAIN                                                                 */}
      {/* --------------------------------------------------------------------- */}

      <main className="p-6 max-w-6xl mx-auto space-y-6">

        {/* INDICATEURS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-100 rounded-xl shadow-card p-4">
            <p className="text-xs text-slate-400">Inscriptions{hasFilters ? ' (filtrées)' : ''}</p>
            <p className="font-heading text-2xl font-bold text-korintek-ink mt-1">{stats.total}</p>
            <p className="text-[11px] text-slate-400 mt-1">{stats.ceMois} ce mois-ci</p>
          </div>
          {canSeeMoney && (
            <div className="bg-white border border-slate-100 rounded-xl shadow-card p-4">
              <p className="text-xs text-slate-400">Encaissé</p>
              <p className="font-heading text-2xl font-bold text-emerald-600 mt-1">{fcfa(stats.encaisse)}</p>
            </div>
          )}
          {canSeeMoney && (
            <div className="bg-white border border-slate-100 rounded-xl shadow-card p-4">
              <p className="text-xs text-slate-400">Reste à encaisser</p>
              <p className="font-heading text-2xl font-bold text-amber-600 mt-1">{fcfa(stats.reste)}</p>
              <button onClick={() => setFilterPayment('DUE')} className="text-[11px] text-korintek-tealDark hover:underline mt-1">Voir les impayés</button>
            </div>
          )}
          <div className="bg-white border border-slate-100 rounded-xl shadow-card p-4">
            <p className="text-xs text-slate-400">Attestations délivrées</p>
            <p className="font-heading text-2xl font-bold text-korintek-ink mt-1">{stats.attestations}</p>
          </div>
        </section>

        {/* RECHERCHE + FILTRES */}
        <section className="bg-white border border-slate-100 rounded-xl shadow-card p-3 flex flex-wrap gap-2 items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : nom, téléphone, email, n° d’attestation…"
            className="flex-1 min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Toutes les formations</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {canSeeMoney && (
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Tous les paiements</option>
              <option value="DUE">Reste à payer</option>
              <option value="SOLDE">Soldé</option>
            </select>
          )}
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setFilterCourse(''); setFilterStatut(''); setFilterPayment(''); }}
              className="text-sm text-slate-500 hover:text-slate-800 px-2"
            >
              Effacer
            </button>
          )}
          <button
            onClick={() => exportCsv(filtered)}
            disabled={!filtered.length}
            className="text-sm font-medium rounded-lg border border-korintek-teal text-korintek-tealDark hover:bg-korintek-tealLighter px-3 py-2 disabled:opacity-40"
          >
            Exporter ({filtered.length}) · Excel
          </button>
        </section>

        {/* ADD STUDENT */}

        <button
          onClick={() =>
            setShowForm((v) => !v)
          }
          className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          + Inscrire un étudiant
        </button>

        {/* ------------------------------------------------------------------- */}
        {/* ADD FORM                                                            */}
        {/* ------------------------------------------------------------------- */}

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-3 gap-3"
          >

            <input
              required
              placeholder="Prénom"
              value={form.prenom}
              onChange={(e) =>
                setForm({
                  ...form,
                  prenom: e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <input
              required
              placeholder="Nom"
              value={form.nom}
              onChange={(e) =>
                setForm({
                  ...form,
                  nom: e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <input
              placeholder="Téléphone"
              value={form.telephone}
              onChange={(e) =>
                setForm({
                  ...form,
                  telephone: e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <select
              required
              value={form.courseId}
              onChange={(e) =>
                setForm({
                  ...form,
                  courseId: e.target.value,
                  sessionId: '',
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">
                Formation...
              </option>

              {courses.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                >
                  {c.title}
                </option>
              ))}
            </select>

            {formSessions.length > 0 && (
              <select
                value={form.sessionId}
                onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Session (facultatif)...</option>
                {formSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.startDate).toLocaleDateString('fr-FR')}
                    {s.capacity ? ` — ${s.seatsTaken}/${s.capacity}${s.full ? ' (complet)' : ''}` : ''}
                  </option>
                ))}
              </select>
            )}

            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentMethod:
                    e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">
                Mode de paiement...
              </option>

              <option value="MOBILE_MONEY">
                Mobile Money
              </option>

              <option value="CASH">
                Espèces
              </option>

              <option value="BANK_TRANSFER">
                Virement
              </option>

              <option value="OTHER">
                Autre
              </option>
            </select>

            <input
              type="number"
              placeholder="Montant payé (FCFA)"
              value={form.amountPaid}
              onChange={(e) =>
                setForm({
                  ...form,
                  amountPaid:
                    e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <button
              type="submit"
              className="md:col-span-3 bg-korintek-teal text-white rounded-lg py-2 font-medium text-sm"
            >
              Enregistrer l'inscription
            </button>

          </form>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TABLE                                                               */}
        {/* ------------------------------------------------------------------- */}

        <section className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead className="bg-slate-50 text-slate-500 text-left">

                <tr>

                  <th className="px-4 py-2">
                    Étudiant
                  </th>

                  <th className="px-4 py-2">
                    Formation
                  </th>

                  <th className="px-4 py-2">
                    Paiement
                  </th>

                  <th className="px-4 py-2">
                    Statut
                  </th>

                  <th className="px-4 py-2">
                    Attestation
                  </th>

                </tr>

              </thead>

              <tbody>

                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                      {enrollments.length ? 'Aucune inscription ne correspond à la recherche.' : 'Aucune inscription pour le moment.'}
                    </td>
                  </tr>
                )}

                {filtered.map((e) => {

                  const paymentComplete =
                    Number(e.amountPaid) >=
                    Number(e.amountDue);

                  const isEditingThisPayment =
                    editingPaymentId === e.id;

                  const isEditingThisStudent =
                    editingStudentId === e.id;

                  return (
                    <tr
                      key={e.id}
                      className="border-t border-slate-100"
                    >

                      {/* --------------------------------------------------- */}
                      {/* ETUDIANT                                            */}
                      {/* --------------------------------------------------- */}

                      <td className="px-4 py-2">

                        {isEditingThisStudent ? (

                          <div className="space-y-2 min-w-[230px]">

                            <div className="grid grid-cols-2 gap-1">

                              <input
                                autoFocus
                                placeholder="Prénom"
                                value={editStudent.prenom}
                                onChange={(ev) =>
                                  setEditStudent({
                                    ...editStudent,
                                    prenom:
                                      ev.target.value,
                                  })
                                }
                                className="rounded border border-slate-300 px-2 py-1 text-xs"
                              />

                              <input
                                placeholder="Nom"
                                value={editStudent.nom}
                                onChange={(ev) =>
                                  setEditStudent({
                                    ...editStudent,
                                    nom:
                                      ev.target.value,
                                  })
                                }
                                className="rounded border border-slate-300 px-2 py-1 text-xs"
                              />

                            </div>

                            <input
                              placeholder="Email"
                              value={editStudent.email}
                              onChange={(ev) =>
                                setEditStudent({
                                  ...editStudent,
                                  email:
                                    ev.target.value,
                                })
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />

                            <input
                              placeholder="Téléphone"
                              value={editStudent.telephone}
                              onChange={(ev) =>
                                setEditStudent({
                                  ...editStudent,
                                  telephone:
                                    ev.target.value,
                                })
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />

                            <div className="flex items-center gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  saveStudent(e.id)
                                }
                                disabled={savingStudent}
                                className="text-xs bg-korintek-teal text-white rounded px-3 py-1 disabled:opacity-50"
                              >
                                {savingStudent
                                  ? 'Enregistrement...'
                                  : 'Enregistrer'}
                              </button>

                              <button
                                type="button"
                                onClick={
                                  cancelEditStudent
                                }
                                disabled={savingStudent}
                                className="text-xs text-slate-400 hover:text-slate-700"
                              >
                                Annuler
                              </button>

                            </div>

                          </div>

                        ) : (

                          <div className="flex items-center gap-2">

                            <span>
                              {e.student?.prenom}{' '}
                              {e.student?.nom}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                startEditStudent(e)
                              }
                              className="text-xs text-slate-400 hover:text-korintek-tealDark underline whitespace-nowrap"
                              title="Modifier les informations de l'apprenant"
                            >
                              Modifier
                            </button>

                          </div>

                        )}

                      </td>

                      {/* --------------------------------------------------- */}
                      {/* FORMATION                                           */}
                      {/* --------------------------------------------------- */}

                      <td className="px-4 py-2">
                        {e.course?.title || '-'}
                      </td>

                      {/* --------------------------------------------------- */}
                      {/* PAIEMENT                                            */}
                      {/* --------------------------------------------------- */}

                      <td className="px-4 py-2 text-slate-500">

                        {isEditingThisPayment ? (

                          <div className="flex items-center gap-1">

                            <input
                              type="number"
                              autoFocus
                              value={editAmount}
                              onChange={(ev) =>
                                setEditAmount(
                                  ev.target.value
                                )
                              }
                              className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                            />

                            <span className="text-xs">
                              /
                              {' '}
                              {Number(
                                e.amountDue || 0
                              ).toLocaleString('fr-FR')}
                              {' '}
                              FCFA
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                savePayment(e.id)
                              }
                              className="text-xs text-korintek-tealDark font-medium ml-1"
                            >
                              OK
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingPaymentId(null)
                              }
                              className="text-xs text-slate-400"
                            >
                              Annuler
                            </button>

                          </div>

                        ) : (

                          <div className="flex items-center gap-2">

                            <span
                              className={
                                paymentComplete
                                  ? ''
                                  : 'text-amber-600 font-medium'
                              }
                            >
                              {Number(
                                e.amountPaid || 0
                              ).toLocaleString('fr-FR')}
                              {' / '}
                              {Number(
                                e.amountDue || 0
                              ).toLocaleString('fr-FR')}
                              {' '}
                              FCFA
                            </span>

                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  startEditPayment(e)
                                }
                                className="text-xs text-slate-400 hover:text-korintek-tealDark underline"
                                title="Modifier le montant payé (SUPER_ADMIN)"
                              >
                                Modifier
                              </button>
                            )}

                          </div>

                        )}

                      </td>

                      {/* --------------------------------------------------- */}
                      {/* STATUT                                              */}
                      {/* --------------------------------------------------- */}

                      <td className="px-4 py-2">

                        <select
                          value={e.statut}
                          onChange={(ev) =>
                            updateStatut(
                              e.id,
                              ev.target.value
                            )
                          }
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${STATUT_BADGE[e.statut] || ''}`}
                        >

                          {Object.entries(
                            STATUT_LABELS
                          ).map(([k, v]) => (

                            <option
                              key={k}
                              value={k}
                            >
                              {v}
                            </option>

                          ))}

                        </select>

                      </td>

                      {/* --------------------------------------------------- */}
                      {/* CERTIFICAT                                           */}
                      {/* --------------------------------------------------- */}

                      <td className="px-4 py-2">

                        {e.certificate ? (

                          <a
                            href={`${import.meta.env.VITE_API_URL}/certificates/${e.certificate.numero}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-korintek-tealDark hover:underline text-xs font-mono"
                          >
                            {e.certificate.numero}
                          </a>

                        ) : paymentComplete ? (

                          <button
                            type="button"
                            onClick={() =>
                              issueCertificate(e.id)
                            }
                            className="text-xs bg-korintek-teal text-white rounded-full px-3 py-1"
                          >
                            Délivrer
                          </button>

                        ) : (

                          <button
                            type="button"
                            disabled
                            title="Paiement incomplet — impossible de délivrer l'attestation"
                            className="text-xs bg-slate-200 text-slate-400 rounded-full px-3 py-1 cursor-not-allowed"
                          >
                            Délivrer
                          </button>

                        )}

                      </td>

                    </tr>
                  );
                })}

                {!enrollments.length && (

                  <tr>

                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-slate-400"
                    >
                      Aucune inscription.
                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </section>

      </main>

    </div>
  );
}
