import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

export default function Enroll() {
  const [searchParams] = useSearchParams();

  const preselectedCourseId =
    searchParams.get('courseId') || '';

  const [courses, setCourses] = useState([]);

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    courseId: preselectedCourseId,
    sessionId: '',
  });

  const [submitted, setSubmitted] =
    useState(false);

  const [error, setError] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  // ---------------------------------------------------------------------------
  // CHARGEMENT DES FORMATIONS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadCourses() {
      try {
        const { data } =
          await apiClient.get('/courses');

        setCourses(data.courses || []);
      } catch (err) {
        setError(
          "Impossible de charger les formations."
        );
      }
    }

    loadCourses();
  }, []);

  // ---------------------------------------------------------------------------
  // FORMATION SELECTIONNEE
  // ---------------------------------------------------------------------------

  const selectedCourse =
    courses.find(
      (c) => c.id === form.courseId
    );

  const sessions =
    selectedCourse?.sessions || [];

  // ---------------------------------------------------------------------------
  // SELECTION AUTOMATIQUE DE LA PREMIERE SESSION
  // ---------------------------------------------------------------------------
  //
  // Si une formation possède des sessions actives,
  // nous sélectionnons automatiquement la première.
  //
  // Cela évite qu'une inscription soit créée avec :
  //
  // sessionId = null
  //
  // et permette ensuite de générer correctement
  // l'attestation à partir de session.startDate.
  //

  useEffect(() => {
    if (
      selectedCourse &&
      sessions.length > 0
    ) {
      const sessionStillValid =
        sessions.some(
          (s) => s.id === form.sessionId
        );

      if (!sessionStillValid) {
        setForm((current) => ({
          ...current,
          sessionId: sessions[0].id,
        }));
      }
    } else if (
      selectedCourse &&
      sessions.length === 0
    ) {
      setForm((current) => ({
        ...current,
        sessionId: '',
      }));
    }
  }, [
    selectedCourse,
    sessions,
    form.sessionId,
  ]);

  // ---------------------------------------------------------------------------
  // FORMAT DATE
  // ---------------------------------------------------------------------------

  function formatDate(date) {
    if (!date) return '';

    return new Date(
      date
    ).toLocaleDateString(
      'fr-FR',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  }

  // ---------------------------------------------------------------------------
  // FORMAT PERIODE DE FORMATION
  // ---------------------------------------------------------------------------
  //
  // La base de données ne demande pas de date de fin.
  //
  // La période affichée sur l'attestation sera calculée
  // à partir de la date de début + 1 mois.
  //

  function getTrainingPeriod(
    startDate
  ) {
    if (!startDate) return '';

    const start =
      new Date(startDate);

    const end =
      new Date(start);

    end.setMonth(
      end.getMonth() + 1
    );

    return `${start.toLocaleDateString(
      'fr-FR',
      {
        month: 'long',
        year: 'numeric',
      }
    )} → ${end.toLocaleDateString(
      'fr-FR',
      {
        month: 'long',
        year: 'numeric',
      }
    )}`;
  }

  // ---------------------------------------------------------------------------
  // CHANGEMENT DE FORMATION
  // ---------------------------------------------------------------------------

  function handleCourseChange(
    e
  ) {
    const courseId =
      e.target.value;

    setForm((current) => ({
      ...current,
      courseId,
      sessionId: '',
    }));

    setError('');
  }

  // ---------------------------------------------------------------------------
  // SOUMISSION
  // ---------------------------------------------------------------------------

  async function handleSubmit(e) {
    e.preventDefault();

    setError('');

    // Formation obligatoire
    if (!form.courseId) {
      setError(
        'Veuillez sélectionner une formation.'
      );

      return;
    }

    // Si la formation possède des sessions,
    // une session doit obligatoirement être choisie.
    if (
      sessions.length > 0 &&
      !form.sessionId
    ) {
      setError(
        'Veuillez sélectionner une session.'
      );

      return;
    }

    setLoading(true);

    try {
      await apiClient.post(
        '/enrollments/public',
        {
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          telephone: form.telephone,
          courseId: form.courseId,
          sessionId:
            form.sessionId || null,
        }
      );

      setSubmitted(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Erreur lors de l'inscription."
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // PAGE APRES INSCRIPTION
  // ---------------------------------------------------------------------------

  if (submitted) {
    return (
      <div className="min-h-screen bg-korintek-tealLighter flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-card p-8 max-w-sm text-center">
          <Logo size={48} />

          <h1 className="font-heading font-bold text-lg text-korintek-ink mt-6 mb-2">
            Inscription enregistrée
          </h1>

          <p className="text-sm text-slate-600 mb-6">
            Merci ! Votre inscription à{' '}
            <strong>
              {selectedCourse?.title}
            </strong>{' '}
            a bien été enregistrée.

            <br />
            <br />

            {form.sessionId &&
              sessions.length > 0 && (
                <>
                  Session :
                  <strong>
                    {' '}
                    {formatDate(
                      sessions.find(
                        (s) =>
                          s.id ===
                          form.sessionId
                      )?.startDate
                    )}
                  </strong>
                </>
              )}

            <br />
            <br />

            Notre équipe vous contactera pour finaliser le paiement et confirmer votre place.
          </p>

          <Link
            to="/catalogue"
            className="text-sm text-korintek-tealDark hover:underline"
          >
            ← Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // FORMULAIRE
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        <div className="flex justify-center mb-6">
          <Logo size={44} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-card p-8 space-y-4"
        >

          <h1 className="font-heading font-bold text-lg text-korintek-ink text-center mb-2">
            Inscription à une formation
          </h1>

          {/* ---------------------------------------------------------------- */}
          {/* FORMATION                                                        */}
          {/* ---------------------------------------------------------------- */}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Formation
            </label>

            <select
              required
              value={form.courseId}
              onChange={
                handleCourseChange
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">
                Choisir une formation...
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
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* SESSION                                                          */}
          {/* ---------------------------------------------------------------- */}

          {selectedCourse &&
            sessions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Session de formation
                </label>

                <select
                  required
                  value={
                    form.sessionId
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sessionId:
                        e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">
                    Choisir une session...
                  </option>

                  {sessions.map(
                    (s) => (
                      <option
                        key={s.id}
                        value={s.id}
                      >
                        {formatDate(
                          s.startDate
                        )}

                        {s.formateur
                          ? ` — ${s.formateur}`
                          : ''}
                      </option>
                    )
                  )}
                </select>

                {/* Informations sur la période */}
                {form.sessionId && (
                  <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    {(() => {
                      const selectedSession =
                        sessions.find(
                          (s) =>
                            s.id ===
                            form.sessionId
                        );

                      if (
                        !selectedSession
                      ) {
                        return null;
                      }

                      return (
                        <>
                          <p className="text-xs text-slate-500">
                            Début de la formation
                          </p>

                          <p className="text-sm font-medium text-korintek-ink">
                            {formatDate(
                              selectedSession.startDate
                            )}
                          </p>

                          <p className="text-xs text-slate-400 mt-1">
                            Période indicative :{' '}
                            {getTrainingPeriod(
                              selectedSession.startDate
                            )}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

          {/* ---------------------------------------------------------------- */}
          {/* SI AUCUNE SESSION N'EST DISPONIBLE                               */}
          {/* ---------------------------------------------------------------- */}

          {selectedCourse &&
            sessions.length === 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-xs text-amber-700">
                  Aucune session n'est actuellement disponible pour cette formation.
                </p>
              </div>
            )}

          {/* ---------------------------------------------------------------- */}
          {/* IDENTITE                                                         */}
          {/* ---------------------------------------------------------------- */}

          <div className="grid grid-cols-2 gap-3">

            <input
              required
              placeholder="Prénom"
              value={form.prenom}
              onChange={(e) =>
                setForm({
                  ...form,
                  prenom:
                    e.target.value,
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
                  nom:
                    e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

          </div>

          {/* ---------------------------------------------------------------- */}
          {/* EMAIL                                                            */}
          {/* ---------------------------------------------------------------- */}

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email:
                  e.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          {/* ---------------------------------------------------------------- */}
          {/* TELEPHONE                                                        */}
          {/* ---------------------------------------------------------------- */}

          <input
            placeholder="Téléphone"
            value={form.telephone}
            onChange={(e) =>
              setForm({
                ...form,
                telephone:
                  e.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          {/* ---------------------------------------------------------------- */}
          {/* ERREUR                                                           */}
          {/* ---------------------------------------------------------------- */}

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* BOUTON                                                           */}
          {/* ---------------------------------------------------------------- */}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-korintek-teal hover:bg-korintek-tealDark text-white font-medium rounded-lg py-2.5 disabled:opacity-60"
          >
            {loading
              ? 'Envoi...'
              : "Confirmer l'inscription"}
          </button>

          {/* ---------------------------------------------------------------- */}
          {/* PAIEMENT                                                         */}
          {/* ---------------------------------------------------------------- */}

          <p className="text-xs text-slate-400 text-center">
            Le paiement sera confirmé avec notre équipe (Mobile Money, espèces ou virement).
          </p>

        </form>
      </div>
    </div>
  );
}
