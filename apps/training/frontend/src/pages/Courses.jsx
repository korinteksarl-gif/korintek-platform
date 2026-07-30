import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', durationHours: '', price: '' });
  const [sessionForms, setSessionForms] = useState({});
  const navigate = useNavigate();

  async function load() {
    const { data } = await apiClient.get('/courses/admin');
    setCourses(data.courses);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    await apiClient.post('/courses', form);
    setForm({ title: '', description: '', durationHours: '', price: '' });
    setShowForm(false);
    load();
  }

  async function toggleActive(course) {
    await apiClient.put(`/courses/${course.id}`, { active: !course.active });
    load();
  }

  async function addSession(courseId) {
    const s = sessionForms[courseId] || {};
    if (!s.startDate) return;
    await apiClient.post(`/courses/${courseId}/sessions`, s);
    setSessionForms({ ...sessionForms, [courseId]: {} });
    load();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <h1 className="font-heading font-bold text-korintek-ink">Formations</h1>
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-sm text-korintek-tealDark hover:underline">← Inscriptions</button>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        <button onClick={() => setShowForm((v) => !v)} className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2">
          + Nouvelle formation
        </button>

        {showForm && (
          <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-2 gap-3">
            <input required placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" rows={2} />
            <input type="number" placeholder="Durée (heures)" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="number" placeholder="Prix (FCFA)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" className="md:col-span-2 bg-korintek-teal text-white rounded-lg py-2 font-medium text-sm">Créer la formation</button>
          </form>
        )}

        <div className="space-y-4">
          {courses.map((c) => (
            <div key={c.id} className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-heading font-bold text-korintek-ink">{c.title}</h2>
                  <p className="text-xs text-slate-400">{c.durationHours}h · {c.price.toLocaleString('fr-FR')} FCFA · {c._count?.enrollments || 0} inscrit(s)</p>
                </div>
                <button onClick={() => toggleActive(c)} className={`text-xs font-medium rounded-full px-3 py-1 ${c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {c.active ? 'Active' : 'Masquée'}
                </button>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">Sessions</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {c.sessions?.map((s) => (
                    <span key={s.id} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                      {new Date(s.startDate).toLocaleDateString('fr-FR')} {s.formateur ? `— ${s.formateur}` : ''}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={sessionForms[c.id]?.startDate || ''}
                    onChange={(e) => setSessionForms({ ...sessionForms, [c.id]: { ...sessionForms[c.id], startDate: e.target.value } })}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    placeholder="Formateur"
                    value={sessionForms[c.id]?.formateur || ''}
                    onChange={(e) => setSessionForms({ ...sessionForms, [c.id]: { ...sessionForms[c.id], formateur: e.target.value } })}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs flex-1"
                  />
                  <button onClick={() => addSession(c.id)} className="text-xs bg-slate-800 text-white rounded-lg px-3 py-1">+ Session</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
