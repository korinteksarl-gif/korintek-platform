import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

// Page atteinte après redirection Microsoft → backend → frontend avec ?token=...
// Récupère le profil utilisateur puis redirige selon son rôle.
export default function AuthCallback() {
  const [status, setStatus] = useState('loading'); // loading | pending | error
  const navigate = useNavigate();

  useEffect(() => {
    async function finalize() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        setStatus('error');
        return;
      }

      localStorage.setItem('korintek_token', token);

      try {
        const { data } = await apiClient.get('/auth/me');
        localStorage.setItem('korintek_user', JSON.stringify(data.user));

        if (data.user.role === 'PENDING') {
          setStatus('pending');
          return;
        }

        if (data.user.role === 'EXAM_CENTER_AGENT') navigate('/agent', { replace: true });
        else navigate('/dashboard', { replace: true });
      } catch (err) {
        setStatus('error');
      }
    }
    finalize();
  }, [navigate]);

  function logout() {
    localStorage.removeItem('korintek_token');
    localStorage.removeItem('korintek_user');
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-korintek-tealLighter px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size={48} />
        </div>
        <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-8 text-center">
        {status === 'loading' && (
          <p className="text-slate-500">Connexion en cours...</p>
        )}

        {status === 'pending' && (
          <>
            <h1 className="text-lg font-bold text-korintek-ink font-heading mb-2">Compte créé</h1>
            <p className="text-sm text-slate-600 mb-6">
              Votre compte Microsoft 365 a bien été reconnu, mais aucun rôle ne vous a
              encore été attribué. Contactez un administrateur KORINTEK pour activer
              votre accès.
            </p>
            <button onClick={logout} className="text-sm text-korintek-tealDark hover:underline">
              Retour à la connexion
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-lg font-bold text-red-600 mb-2">Erreur de connexion</h1>
            <p className="text-sm text-slate-600 mb-6">
              La connexion via Microsoft 365 a échoué. Réessayez ou contactez un administrateur.
            </p>
            <button onClick={logout} className="text-sm text-korintek-tealDark hover:underline">
              Retour à la connexion
            </button>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
