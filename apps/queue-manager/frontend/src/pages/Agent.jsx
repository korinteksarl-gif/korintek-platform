import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

// Interface tablette Android — boutons géants, zéro friction pour l'agent d'accueil
export default function Agent() {
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  async function refresh() {
    const { data } = await apiClient.get('/queue/current');
    setCurrent(data.candidate);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  async function callNext() {
    setLoading(true);
    setMessage('');
    try {
      const { data } = await apiClient.post('/queue/next');
      setCurrent(data.candidate);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erreur.');
    } finally {
      setLoading(false);
    }
  }

  async function complete() {
    if (!current) return;
    await apiClient.post(`/queue/${current.id}/complete`);
    setCurrent(null);
  }

  async function markAbsent() {
    if (!current) return;
    await apiClient.post(`/queue/${current.id}/absent`);
    setCurrent(null);
  }

  function logout() {
    localStorage.removeItem('korintek_token');
    localStorage.removeItem('korintek_user');
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-korintek-blueLight flex flex-col">
      <div className="flex justify-between items-center px-6 py-4">
        <span className="text-korintek-blueDark font-bold text-lg">KORINTEK — Accueil</span>
        <button onClick={logout} className="text-sm text-slate-500">Déconnexion</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="uppercase tracking-widest text-slate-500 text-sm font-medium mb-4">Candidat actuel</p>

        {current ? (
          <>
            <p className="text-7xl font-black text-korintek-blueDark mb-2">{current.numero}</p>
            <p className="text-3xl font-bold text-slate-800 mb-1">{current.prenom} {current.nom}</p>
            <p className="text-lg text-slate-500 mb-10">Examen : {current.examen}</p>
          </>
        ) : (
          <p className="text-2xl text-slate-400 mb-10">Aucun candidat appelé</p>
        )}

        {message && <p className="text-red-600 mb-4">{message}</p>}

        <div className="grid grid-cols-1 gap-4 w-full max-w-md">
          <button
            onClick={callNext}
            disabled={loading}
            className="bg-korintek-blue hover:bg-korintek-blueDark text-white text-2xl font-bold rounded-2xl py-6 shadow-md disabled:opacity-60"
          >
            APPELER SUIVANT
          </button>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={complete}
              disabled={!current}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xl font-bold rounded-2xl py-6 shadow-md disabled:opacity-40"
            >
              TERMINER
            </button>
            <button
              onClick={markAbsent}
              disabled={!current}
              className="bg-red-600 hover:bg-red-700 text-white text-xl font-bold rounded-2xl py-6 shadow-md disabled:opacity-40"
            >
              ABSENT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
