import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    durationHours: '',
    price: '',
  });
  const [sessionForms, setSessionForms] = useState({});
  const navigate = useNavigate();

  async function load() {
    try {
      const [coursesRes, trainersRes] = await Promise.all([
        apiClient.get('/courses/admin'),
        apiClient.get('/trainers'),
      ]);

      setCourses(coursesRes.data.courses);
      setTrainers(
        trainersRes.data.trainers.filter((t) => t.active)
      );
    } catch (err) {
      console.error('Erreur lors du chargement des formations :', err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();

    try {
      await apiClient.post('/courses', form);

      setForm({
        title: '',
        description: '',
        durationHours: '',
        price: '',
      });

      setShowForm(false);
      load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        'Impossible de créer la formation.'
      );
    }
  }

  async function toggleActive(course) {
    try {
      await apiClient.put(`/courses/${course.id}`, {
        active: !course.active,
      });

      load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        'Impossible de modifier la formation.'
      );
    }
  }

  async function addSession(courseId) {
    const s = sessionForms[courseId] || {};

    if (!s.startDate) {
      alert('Veuillez renseigner la date de début de la formation.');
      return;
    }

    try {
      /*
       * Nous ne demandons plus de date de fin.
       *
       * La règle KORINTEK est :
       *   date de début = date de la session
       *   période du certificat = mois de début → mois suivant
       *
       * Le backend conserve donc uniquement startDate.
       */
      const payload = {
        startDate: s.startDate,
        trainerId: s.trainerId || null,
        formateur: s.formateur || null,
      };

      await apiClient.post(
        `/courses/${courseId}/sessions`,
        payload
      );

      setSessionForms({
        ...sessionForms,
        [courseId]: {},
      });

      load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        'Impossible de créer la session.'
      );
    }
  }

  async function removeSession(sessionId) {
    if (!confirm('Supprimer cette session ?')) return;

    try {
      await apiClient.delete(`/courses/sessions/${sessionId}`);
      load();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        'Impossible de supprimer la session.'
      );
    }
  }

  /*
   * Retourne le nom du mois de la date de début.
   * Exemple :
   * 03/08/2026 → AOÛT 2026
   */
  function formatMonth(dateValue) {
    if (!dateValue) return '';

    const date = new Date(dateValue);

    return date
      .toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      })
      .toUpperCase();
  }

  /*
   * Calcule le mois suivant.
   *
   * Exemple :
   * AOÛT 2026 → SEPTEMBRE 2026
   */
  function formatNextMonth(dateValue) {
    if (!dateValue) return '';

    const date = new Date(dateValue);

    date.setMonth(date.getMonth() + 1);

    return date
      .toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      })
      .toUpperCase();
  }

  /*
   * Affichage de la période d'une session.
   *
   * Nous ignorons volontairement endDate.
   * La période est toujours :
   *
   * mois de startDate → mois suivant
   */
  function formatSessionPeriod(s) {
    const startMonth = formatMonth(s.startDate);
    const nextMonth = formatNextMonth(s.startDate);

    if (!startMonth) {
      return 'Date de début non renseignée';
    }

    return `${startMonth} → ${nextMonth}`;
  }

  function formatStartDate(s) {
    if (!s.startDate) return '';

    return new Date(s.startDate).toLocaleDateString(
      'fr-FR',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  }

  function trainerLabel(s) {
    if (s.trainer) {
      return `Formateur : ${s.trainer.prenom} ${s.trainer.nom}`;
    }

    if (s.formateur) {
      return `Formateur : ${s.formateur}`;
    }

    return 'Formateur non assigné';
  }

  return (
    <div className="min-h-screen page-bg">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo
            size={36}
            showWordmark={false}
          />

          <h1 className="font-heading font-bold text-korintek-ink">
            Formations
          </h1>
        </div>

        <div className="flex items-center gap-4">

          <button
            onClick={() => navigate('/formateurs')}
            className="text-sm text-korintek-tealDark hover:underline"
          >
            Formateurs
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-korintek-tealDark hover:underline"
          >
            ← Inscriptions
          </button>

        </div>
      </header>

      {/* CONTENT */}
      <main className="p-6 max-w-4xl mx-auto space-y-6">

        {/* NOUVELLE FORMATION */}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          + Nouvelle formation
        </button>

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-2 gap-3"
          >

            <input
              required
              placeholder="Titre"
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              rows={2}
            />

            <input
              type="number"
              placeholder="Durée (heures)"
              value={form.durationHours}
              onChange={(e) =>
                setForm({
                  ...form,
                  durationHours: e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <input
              type="number"
              placeholder="Prix (FCFA)"
              value={form.price}
              onChange={(e) =>
                setForm({
                  ...form,
                  price: e.target.value,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <button
              type="submit"
              className="md:col-span-2 bg-korintek-teal text-white rounded-lg py-2 font-medium text-sm"
            >
              Créer la formation
            </button>

          </form>
        )}

        {/* LISTE DES FORMATIONS */}
        <div className="space-y-4">

          {courses.map((c) => {

            const sortedSessions = [
              ...(c.sessions || []),
            ].sort(
              (a, b) =>
                new Date(a.startDate) -
                new Date(b.startDate)
            );

            return (
              <div
                key={c.id}
                className="bg-white border border-slate-100 rounded-xl shadow-card p-5"
              >

                {/* COURSE HEADER */}
                <div className="flex justify-between items-start">

                  <div>

                    <h2 className="font-heading font-bold text-korintek-ink">
                      {c.title}
                    </h2>

                    <p className="text-xs text-slate-400">
                      {c.durationHours}h ·{' '}
                      {c.price.toLocaleString('fr-FR')} FCFA ·{' '}
                      {c._count?.enrollments || 0} inscrit(s)
                    </p>

                  </div>

                  <button
                    onClick={() => toggleActive(c)}
                    className={`text-xs font-medium rounded-full px-3 py-1 ${
                      c.active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.active ? 'Active' : 'Masquée'}
                  </button>

                </div>

                {/* SESSIONS */}
                <div className="mt-4 border-t border-slate-100 pt-3">

                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Sessions
                  </p>

                  <div className="flex flex-col gap-2 mb-3">

                    {sortedSessions.map((s) => (

                      <div
                        key={s.id}
                        className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                      >

                        <div className="flex-1">

                          {/* DATE DEBUT */}
                          <div>
                            <span className="font-medium text-slate-700">
                              Début : {formatStartDate(s)}
                            </span>
                          </div>

                          {/* PERIODE CERTIFICAT */}
                          <div className="mt-1">
                            <span className="text-korintek-tealDark font-semibold">
                              Période certificat :{' '}
                              {formatSessionPeriod(s)}
                            </span>
                          </div>

                          {/* FORMATEUR */}
                          <div className="mt-1">
                            <span className="text-slate-400">
                              {trainerLabel(s)}
                            </span>

                            {s.trainer && (
                              <span
                                className={`ml-2 font-medium rounded-full px-2 py-0.5 ${
                                  s.paymentStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {s.paymentStatus === 'PAID'
                                  ? 'Payé'
                                  : 'À payer'}
                              </span>
                            )}
                          </div>

                        </div>

                        {/* DELETE */}
                        <button
                          onClick={() =>
                            removeSession(s.id)
                          }
                          className="text-red-500 hover:text-red-700 font-medium ml-3"
                        >
                          Supprimer
                        </button>

                      </div>

                    ))}

                    {!sortedSessions.length && (
                      <p className="text-xs text-slate-400 italic">
                        Aucune session programmée.
                      </p>
                    )}

                  </div>

                  {/* AJOUT SESSION */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">

                    {/* DATE DE DEBUT */}
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Début de la formation
                      </label>

                      <input
                        type="date"
                        value={
                          sessionForms[c.id]?.startDate || ''
                        }
                        onChange={(e) =>
                          setSessionForms({
                            ...sessionForms,
                            [c.id]: {
                              ...sessionForms[c.id],
                              startDate: e.target.value,
                            },
                          })
                        }
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs w-full"
                      />

                      <p className="text-[10px] text-slate-400 mt-1">
                        La période sera automatiquement calculée.
                      </p>
                    </div>

                    {/* FORMATEUR ANNUAIRE */}
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Formateur (annuaire)
                      </label>

                      <select
                        value={
                          sessionForms[c.id]?.trainerId || ''
                        }
                        onChange={(e) =>
                          setSessionForms({
                            ...sessionForms,
                            [c.id]: {
                              ...sessionForms[c.id],
                              trainerId: e.target.value,
                            },
                          })
                        }
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs w-full"
                      >

                        <option value="">
                          Aucun / texte libre
                        </option>

                        {trainers.map((t) => (
                          <option
                            key={t.id}
                            value={t.id}
                          >
                            {t.prenom} {t.nom}
                          </option>
                        ))}

                      </select>
                    </div>

                    {/* NOM LIBRE */}
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Ou nom libre
                      </label>

                      <input
                        placeholder="Nom du formateur"
                        value={
                          sessionForms[c.id]?.formateur || ''
                        }
                        onChange={(e) =>
                          setSessionForms({
                            ...sessionForms,
                            [c.id]: {
                              ...sessionForms[c.id],
                              formateur: e.target.value,
                            },
                          })
                        }
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs w-full"
                      />
                    </div>

                    {/* BOUTON */}
                    <div className="flex items-end">

                      <button
                        type="button"
                        onClick={() =>
                          addSession(c.id)
                        }
                        className="text-xs bg-slate-800 text-white rounded-lg px-3 py-1.5 w-full"
                      >
                        + Session
                      </button>

                    </div>

                  </div>

                </div>

              </div>
            );
          })}

        </div>

      </main>

    </div>
  );
}
