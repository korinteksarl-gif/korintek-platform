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

  // ---------------------------------------------------------------------------
  // CERTIFICATE ISSUE FORM
  // ---------------------------------------------------------------------------

  const [certificateEnrollment, setCertificateEnrollment] = useState(null);
  const [certificateForm, setCertificateForm] = useState({
    trainingStartDate: '',
    trainingEndDate: '',
    durationHours: '',
    completionDate: '',
  });
  const [issuingCertificate, setIssuingCertificate] = useState(false);

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    courseId: '',
    paymentMethod: '',
    amountPaid: '',
  });

  // ---------------------------------------------------------------------------
  // ARCHIVE / DELETE CERTIFICATE
  // ---------------------------------------------------------------------------

  async function archiveCertificate(certificate) {
    const reason = window.prompt(
      `Motif d'archivage de l'attestation ${certificate.numero} :`,
      'Erreur sur les informations de l'attestation'
    );

    if (reason === null) return;

    const cleanReason = reason.trim();

    if (!cleanReason) {
      alert("Le motif d'archivage est obligatoire.");
      return;
    }

    const confirmed = window.confirm(
      `Archiver l'attestation ${certificate.numero} ?\n\n` +
      `Elle ne sera plus considérée comme valide publiquement. ` +
      `Vous pourrez ensuite rééditer une nouvelle attestation pour cette inscription.`
    );

    if (!confirmed) return;

    try {
      await apiClient.post(
        `/certificates/${encodeURIComponent(certificate.numero)}/archive`,
        { reason: cleanReason }
      );

      await load();
      alert('Attestation archivée avec succès.');
    } catch (err) {
      alert(
        err.response?.data?.error ||
        "Erreur lors de l'archivage de l'attestation."
      );
    }
  }

  async function deleteCertificate(certificate) {
    const confirmed = window.confirm(
      `SUPPRESSION DÉFINITIVE\n\n` +
      `Attestation : ${certificate.numero}\n` +
      `Cette action est irréversible. Continuer ?`
    );

    if (!confirmed) return;

    try {
      await apiClient.delete(
        `/certificates/${encodeURIComponent(certificate.numero)}`
      );

      await load();
      alert('Attestation supprimée définitivement.');
    } catch (err) {
      alert(
        err.response?.data?.error ||
        "Erreur lors de la suppression de l'attestation."
      );
    }
  }

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
  const canManageCertificates =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN';

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

  function toDateInputValue(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function openCertificateIssue(enrollment) {
    const today = new Date().toISOString().slice(0, 10);
    const sessionStart = toDateInputValue(enrollment.session?.startDate);
    const sessionEnd = toDateInputValue(enrollment.session?.endDate);

    setCertificateEnrollment(enrollment);
    setCertificateForm({
      trainingStartDate: sessionStart || today,
      trainingEndDate: sessionEnd || sessionStart || today,
      durationHours: String(enrollment.course?.durationHours ?? ''),
      completionDate: today,
    });
  }

  function closeCertificateIssue() {
    if (issuingCertificate) return;
    setCertificateEnrollment(null);
  }

  async function issueCertificate() {
    if (!certificateEnrollment) return;

    const {
      trainingStartDate,
      trainingEndDate,
      durationHours,
      completionDate,
    } = certificateForm;

    if (!trainingStartDate || !trainingEndDate || !durationHours || !completionDate) {
      alert('Veuillez renseigner la période de formation, le nombre d’heures et la date d’obtention.');
      return;
    }

    if (trainingEndDate < trainingStartDate) {
      alert('La date de fin ne peut pas être antérieure à la date de début.');
      return;
    }

    if (Number(durationHours) <= 0) {
      alert("Le nombre d'heures doit être supérieur à 0.");
      return;
    }

    setIssuingCertificate(true);

    try {
      await apiClient.post(
        '/certificates/issue',
        {
          enrollmentId: certificateEnrollment.id,
          trainingStartDate,
          trainingEndDate,
          durationHours: Number(durationHours),
          completionDate,
        }
      );

      setCertificateEnrollment(null);
      await load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        'Erreur lors de la délivrance.'
      );
    } finally {
      setIssuingCertificate(false);
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

                {enrollments.map((e) => {

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

                          <div className="flex flex-col gap-2 min-w-[220px]">

                            {e.certificate.archivedAt ? (

                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-xs font-mono text-slate-400 line-through"
                                  title={e.certificate.archiveReason || 'Attestation archivée'}
                                >
                                  {e.certificate.numero}
                                </span>

                                <span className="text-[10px] uppercase tracking-wide font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-1">
                                  Archivée
                                </span>
                              </div>

                            ) : (

                              <a
                                href={`${import.meta.env.VITE_API_URL}/certificates/${e.certificate.numero}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-korintek-tealDark hover:underline text-xs font-mono"
                              >
                                {e.certificate.numero}
                              </a>

                            )}

                            {e.certificate.archivedAt ? (

                              <div className="flex items-center gap-2 flex-wrap">
                                {paymentComplete && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openCertificateIssue(e)
                                    }
                                    className="text-xs bg-korintek-teal text-white rounded-full px-3 py-1"
                                  >
                                    Rééditer
                                  </button>
                                )}

                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteCertificate(e.certificate)
                                    }
                                    className="text-xs text-red-600 hover:text-red-800 underline"
                                  >
                                    Supprimer définitivement
                                  </button>
                                )}
                              </div>

                            ) : canManageCertificates ? (

                              <button
                                type="button"
                                onClick={() =>
                                  archiveCertificate(e.certificate)
                                }
                                className="text-xs text-amber-700 hover:text-amber-900 underline text-left w-fit"
                              >
                                Archiver si erreur
                              </button>

                            ) : null}

                          </div>

                        ) : paymentComplete ? (

                          <button
                            type="button"
                            onClick={() =>
                              openCertificateIssue(e)
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

        {/* ----------------------------------------------------------------- */}
        {/* CERTIFICATE ISSUE MODAL                                          */}
        {/* ----------------------------------------------------------------- */}

        {certificateEnrollment && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 bg-korintek-navy text-white">
                <p className="text-xs uppercase tracking-widest text-korintek-teal font-semibold">
                  Génération de l’attestation
                </p>
                <h2 className="font-heading font-bold text-lg mt-1">
                  {certificateEnrollment.student?.prenom} {certificateEnrollment.student?.nom}
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  {certificateEnrollment.course?.title}
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div className="rounded-xl border border-korintek-gold/30 bg-amber-50 px-4 py-3 text-xs text-slate-600">
                  Ces informations sont <strong>définies manuellement pour cette attestation</strong>.
                  Elles seront enregistrées dans le certificat et utilisées pour le PDF et la vérification.
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-korintek-ink mb-3">Période de formation</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs text-slate-500">
                      Date de début
                      <input
                        required
                        type="date"
                        value={certificateForm.trainingStartDate}
                        onChange={(e) => setCertificateForm({ ...certificateForm, trainingStartDate: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                      />
                    </label>

                    <label className="text-xs text-slate-500">
                      Date de fin
                      <input
                        required
                        type="date"
                        value={certificateForm.trainingEndDate}
                        min={certificateForm.trainingStartDate || undefined}
                        onChange={(e) => setCertificateForm({ ...certificateForm, trainingEndDate: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Le PDF affichera automatiquement les mois concernés, par exemple : AOÛT 2026 - SEPTEMBRE 2026.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-slate-500">
                    Nombre d’heures de formation
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={certificateForm.durationHours}
                      onChange={(e) => setCertificateForm({ ...certificateForm, durationHours: e.target.value })}
                      placeholder="40"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                    />
                  </label>

                  <label className="text-xs text-slate-500">
                    Date d’obtention
                    <input
                      required
                      type="date"
                      value={certificateForm.completionDate}
                      onChange={(e) => setCertificateForm({ ...certificateForm, completionDate: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeCertificateIssue}
                    disabled={issuingCertificate}
                    className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={issueCertificate}
                    disabled={issuingCertificate}
                    className="px-5 py-2 rounded-lg bg-korintek-teal text-white text-sm font-medium hover:bg-korintek-tealDark disabled:opacity-50"
                  >
                    {issuingCertificate ? 'Génération...' : 'Générer l’attestation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
