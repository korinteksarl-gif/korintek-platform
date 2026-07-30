import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

export default function Enroll() {
  const [searchParams] = useSearchParams();
  const preselectedCourseId = searchParams.get('courseId') || '';
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', telephone: '', courseId: preselectedCourseId, sessionId: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient.get('/courses').then(({ data }) => setCourses(data.courses));
  }, []);

  const selectedCourse = courses.find((c) => c.id === form.courseId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/enrollments/public', form);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-korintek-tealLighter flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-card p-8 max-w-sm text-center">
          <Logo size={48} />
          <h1 className="font-heading font-bold text-lg text-korintek-ink mt-6 mb-2">Inscription enregistrée</h1>
          <p className="text-sm text-slate-600 mb-6">
            Merci ! Votre inscription à <strong>{selectedCourse?.title}</strong> a bien été enregistrée.
            Notre équipe vous contactera pour finaliser le paiement et confirmer votre place.
          </p>
          <Link to="/catalogue" className="text-sm text-korintek-tealDark hover:underline">← Retour au catalogue</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo size={44} /></div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-card p-8 space-y-4">
          <h1 className="font-heading font-bold text-lg text-korintek-ink text-center mb-2">Inscription à une formation</h1>

          <select
            required
            value={form.courseId}
            onChange={(e) => setForm({ ...form, courseId: e.target.value, sessionId: '' })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Choisir une formation...</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>

          {selectedCourse?.sessions?.length > 0 && (
            <select
              value={form.sessionId}
              onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Session (optionnel)</option>
              {selectedCourse.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.startDate).toLocaleDateString('fr-FR')} {s.formateur ? `— ${s.formateur}` : ''}
                </option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input required placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="w-full bg-korintek-teal hover:bg-korintek-tealDark text-white font-medium rounded-lg py-2.5 disabled:opacity-60">
            {loading ? 'Envoi...' : "Confirmer l'inscription"}
          </button>
          <p className="text-xs text-slate-400 text-center">Le paiement sera confirmé avec notre équipe (Mobile Money, espèces ou virement).</p>
        </form>
      </div>
    </div>
  );
}
