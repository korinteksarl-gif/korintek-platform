import { useEffect, useState } from 'react';
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

export default function Dashboard() {
  const [enrollments, setEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    courseId: '',
    paymentMethod: '',
    amountPaid: '',
  });

  // ==========================================================
  // PAIEMENT
  // ==========================================================

  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  // ==========================================================
  // APPRENANT
  // ==========================================================

  const [editingStudentId, setEditingStudentId] = useState(null);

  const [studentForm, setStudentForm] = useState({
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

  const canEditStudent =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN';

  // ==========================================================
  // CHARGEMENT
  // ==========================================================

  async function load() {
    try {
      const [enrRes, courseRes] = await Promise.all([
        apiClient.get('/enrollments'),
        apiClient.get('/courses'),
      ]);

      setEnrollments(enrRes.data.enrollments);
      setCourses(courseRes.data.courses);
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ==========================================================
  // DECONNEXION
  // ==========================================================

  function logout() {
    localStorage.removeItem('korintek_training_token');
    localStorage.removeItem('korintek_training_user');

    navigate('/login');
  }

  // ==========================================================
  // AJOUT INSCRIPTION
  // ==========================================================

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

  // ==========================================================
  // STATUT
  // ==========================================================

  async function updateStatut(id, statut) {
    try {
      await apiClient.put(`/enrollments/${id}`, {
        statut,
      });

      await load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erreur lors de la mise à jour du statut.'
      );
    }
  }

  // ==========================================================
  // ATTESTATION
  // ==========================================================

  async function issueCertificate(enrollmentId) {
    try {
      await apiClient.post('/certificates/issue', {
        enrollmentId,
      });

      await load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erreur lors de la délivrance.'
      );
    }
  }

  // ==========================================================
  // MODIFICATION PAIEMENT
  // ==========================================================

  function startEditPayment(enrollment) {
    setEditingPaymentId(enrollment.id);
    setEditAmount(String(enrollment.amountPaid));
  }

  async function savePayment(id) {
    try {
      await apiClient.put(`/enrollments/${id}`, {
        amountPaid: Number(editAmount),
      });

      setEditingPaymentId(null);

      await load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erreur lors de la mise à jour du paiement.'
      );
    }
  }

  // ==========================================================
  // MODIFICATION APPRENANT
  // ==========================================================

  function startEditStudent(enrollment) {
    if (!enrollment.student) return;

    setEditingStudentId(enrollment.id);

    setStudentForm({
      nom: enrollment.student.nom || '',
      prenom: enrollment.student.prenom || '',
      email: enrollment.student.email || '',
      telephone: enrollment.student.telephone || '',
    });
  }

  function cancelEditStudent() {
    setEditingStudentId(null);

    setStudentForm({
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
    });
  }

  async function saveStudent(id) {
    if (!studentForm.nom.trim() || !studentForm.prenom.trim()) {
      alert('Le nom et le prénom sont requis.');
      return;
    }

    setSavingStudent(true);

    try {
      await apiClient.put(
        `/enrollments/${id}/student`,
        {
          nom: studentForm.nom.trim(),
          prenom: studentForm.prenom.trim(),
          email: studentForm.email.trim(),
          telephone: studentForm.telephone.trim(),
        }
      );

      cancelEditStudent();

      await load();

      alert('Les informations de l’apprenant ont été corrigées.');
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erreur lors de la correction de l’apprenant.'
      );
    } finally {
      setSavingStudent(false);
    }
  }

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <div className="min-h-screen page-bg">

      {/* ======================================================
          HEADER
      ====================================================== */}

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
              {user?.prenom} {user?.nom} · {user?.role}
            </p>
          </div>

        </div>

        <div className="flex items-center gap-3">

          {(user?.role === 'SUPER_ADMIN' ||
            user?.role === 'ADMIN') && (
            <button
              onClick={() => navigate('/formations')}
              className="text-sm text-korintek-tealDark hover:underline"
            >
              Formations
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

      {/* ======================================================
          CONTENU
      ====================================================== */}

      <main className="p-6 max-w-6xl mx-auto space-y-6">

        {/* ====================================================
            AJOUT INSCRIPTION
        ==================================================== */}

        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          + Inscrire un étudiant
        </button>

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

            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentMethod: e.target.value,
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
                  amountPaid: e.target.value,
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

        {/* ====================================================
            TABLEAU
        ==================================================== */}

        <section className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">

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

              {enrollments.map((e) => {

                const paymentComplete =
                  e.amountPaid >= e.amountDue;

                const isEditingThisPayment =
                  editingPaymentId === e.id;

                const isEditingThisStudent =
                  editingStudentId === e.id;

                return (
                  <tr
                    key={e.id}
                    className="border-t border-slate-100"
                  >

                    {/* =================================================
                        ETUDIANT
                    ================================================= */}

                    <td className="px-4 py-2">

                      {isEditingThisStudent ? (

                        <div className="min-w-[260px] space-y-2">

                          <input
                            autoFocus
                            placeholder="Prénom"
                            value={studentForm.prenom}
                            onChange={(ev) =>
                              setStudentForm({
                                ...studentForm,
                                prenom: ev.target.value,
                              })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />

                          <input
                            placeholder="Nom"
                            value={studentForm.nom}
                            onChange={(ev) =>
                              setStudentForm({
                                ...studentForm,
                                nom: ev.target.value,
                              })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />

                          <input
                            type="email"
                            placeholder="Email"
                            value={studentForm.email}
                            onChange={(ev) =>
                              setStudentForm({
                                ...studentForm,
                                email: ev.target.value,
                              })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />

                          <input
                            placeholder="Téléphone"
                            value={studentForm.telephone}
                            onChange={(ev) =>
                              setStudentForm({
                                ...studentForm,
                                telephone: ev.target.value,
                              })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />

                          <div className="flex items-center gap-2">

                            <button
                              type="button"
                              disabled={savingStudent}
                              onClick={() =>
                                saveStudent(e.id)
                              }
                              className="text-xs bg-korintek-teal text-white rounded px-3 py-1 disabled:opacity-50"
                            >
                              {savingStudent
                                ? 'Enregistrement...'
                                : 'Enregistrer'}
                            </button>

                            <button
                              type="button"
                              disabled={savingStudent}
                              onClick={cancelEditStudent}
                              className="text-xs text-slate-400 hover:text-slate-700"
                            >
                              Annuler
                            </button>

                          </div>

                        </div>

                      ) : (

                        <div className="flex items-center gap-2">

                          <span>
                            {e.student.prenom}{' '}
                            {e.student.nom}
                          </span>

                          {canEditStudent && (
                            <button
                              type="button"
                              onClick={() =>
                                startEditStudent(e)
                              }
                              className="text-xs text-slate-400 hover:text-korintek-tealDark underline"
                              title="Modifier les informations de l'apprenant"
                            >
                              Modifier
                            </button>
                          )}

                        </div>

                      )}

                    </td>

                    {/* =================================================
                        FORMATION
                    ================================================= */}

                    <td className="px-4 py-2">
                      {e.course.title}
                    </td>

                    {/* =================================================
                        PAIEMENT
                    ================================================= */}

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
                            /{' '}
                            {e.amountDue.toLocaleString(
                              'fr-FR'
                            )}{' '}
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
                            {e.amountPaid.toLocaleString(
                              'fr-FR'
                            )}{' '}
                            /{' '}
                            {e.amountDue.toLocaleString(
                              'fr-FR'
                            )}{' '}
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

                    {/* =================================================
                        STATUT
                    ================================================= */}

                    <td className="px-4 py-2">

                      <select
                        value={e.statut}
                        onChange={(ev) =>
                          updateStatut(
                            e.id,
                            ev.target.value
                          )
                        }
                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${STATUT_BADGE[e.statut]}`}
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

                    {/* =================================================
                        ATTESTATION
                    ================================================= */}

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

        </section>

      </main>

    </div>
  );
}
