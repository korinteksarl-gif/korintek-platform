import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

export default function AuthCallback() {
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    async function finalize() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (!token) { setStatus('error'); return; }

      localStorage.setItem('korintek_training_token', token);
      try {
        const { data } = await apiClient.get('/auth/me');
        localStorage.setItem('korintek_training_user', JSON.stringify(data.user));
        if (data.user.role === 'PENDING') { setStatus('pending'); return; }
        navigate('/dashboard', { replace: true });
      } catch {
        setStatus('error');
      }
    }
    finalize();
  }, [navigate]);

  function logout() {
    localStorage.removeItem('korintek_training_token');
    localStorage.removeItem('korintek_training_user');
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-korintek-tealLighter px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo size={48} /></div>
        <div className="bg-white rounded-2xl shadow-card p-8 text-center">
          {status === 'loading' && <p className="text-slate-500">Connexion en cours...</p>}
          {status === 'pending' && (
            <>
              <h1 className="font-heading font-bold text-korintek-ink mb-2">Compte créé</h1>
              <p className="text-sm text-slate-600 mb-6">Aucun rôle ne vous a encore été attribué. Contactez un administrateur.</p>
              <button onClick={logout} className="text-sm text-korintek-tealDark hover:underline">Retour</button>
            </>
          )}
          {status === 'error' && (
            <>
              <h1 className="font-bold text-red-600 mb-2">Erreur de connexion</h1>
              <button onClick={logout} className="text-sm text-korintek-tealDark hover:underline">Retour</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
