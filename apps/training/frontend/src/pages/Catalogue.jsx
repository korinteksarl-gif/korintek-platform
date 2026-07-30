import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

export default function Catalogue() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/courses').then(({ data }) => setCourses(data.courses)).finally(() => setLoading(false));
  }, []);

  function formatFCFA(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <Logo size={36} />
        <Link to="/verifier" className="text-sm text-korintek-tealDark hover:underline">Vérifier une attestation</Link>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <h1 className="font-heading text-2xl font-bold text-korintek-ink mb-1">Nos formations</h1>
        <p className="text-slate-500 mb-8">Certifications Change Lives — choisissez une formation pour vous inscrire.</p>

        {loading && <p className="text-slate-400">Chargement...</p>}

        <div className="grid md:grid-cols-2 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="bg-white border border-slate-100 rounded-xl shadow-card p-5 flex flex-col">
              <h2 className="font-heading font-bold text-lg text-korintek-ink mb-1">{c.title}</h2>
              {c.description && <p className="text-sm text-slate-500 mb-3 flex-1">{c.description}</p>}
              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-slate-400">{c.durationHours}h</span>
                <span className="font-semibold text-korintek-tealDark">{formatFCFA(c.price)}</span>
              </div>
              {c.sessions?.length > 0 && (
                <p className="text-xs text-slate-400 mb-3">
                  Prochaine session : {new Date(c.sessions[0].startDate).toLocaleDateString('fr-FR')}
                </p>
              )}
              <Link
                to={`/inscription?courseId=${c.id}`}
                className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg py-2 text-center"
              >
                S'inscrire
              </Link>
            </div>
          ))}
          {!loading && !courses.length && (
            <p className="text-slate-400 col-span-2 text-center py-12">Aucune formation disponible pour le moment.</p>
          )}
        </div>
      </main>
    </div>
  );
}
