import { useState } from 'react';
import Logo from '../components/Logo.jsx';

function apiBaseUrl() {
  return import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  function handleMicrosoftLogin() {
    setLoading(true);
    window.location.href = `${apiBaseUrl()}/auth/microsoft/login`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-korintek-tealLighter px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size={52} />
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-8 text-center">
          <h1 className="font-heading font-bold text-lg text-korintek-ink mb-1">
            Bienvenue
          </h1>
          <p className="text-sm text-slate-400 mb-8">Connectez-vous pour accéder à la file d'attente</p>

          {error === 'compte_desactive' && (
            <p className="text-sm text-red-600 mb-4">
              Ce compte est désactivé. Contactez un administrateur.
            </p>
          )}

          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-korintek-teal hover:shadow-cardHover text-slate-700 font-medium rounded-xl py-3 transition-all disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            {loading ? 'Redirection...' : 'Se connecter avec Microsoft 365'}
          </button>

          <p className="text-xs text-slate-400 mt-6">
            Connexion réservée aux comptes KORINTEK Office 365.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 font-medium tracking-wide uppercase mt-8">
          Certifications Change Lives
        </p>
      </div>
    </div>
  );
}
