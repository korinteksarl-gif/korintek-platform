import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

const ERROR_MESSAGES = {
  microsoft_denied: "Connexion Microsoft annulée ou refusée.",
  missing_code: 'Erreur de connexion : code manquant.',
  token_exchange_failed: 'Erreur lors de la connexion à Microsoft. Réessayez.',
  profile_fetch_failed: 'Impossible de récupérer votre profil Microsoft.',
  no_email: "Aucune adresse email trouvée sur ce compte Microsoft.",
  account_disabled: 'Ce compte a été désactivé. Contactez un administrateur.',
};

export default function Login() {
  const [searchParams] = useSearchParams();
  const urlError = searchParams.get('error');
  const [showLocalForm, setShowLocalForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

  async function handleLocalLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', form);
      localStorage.setItem('korintek_crm_token', data.token);
      localStorage.setItem('korintek_crm_user', JSON.stringify(data.user));
      window.location.href = '/pipeline';
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-korintek-tealLighter flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6"><Logo size={48} /></div>
        <div className="bg-white rounded-2xl shadow-card p-8">
          <h1 className="font-heading font-bold text-lg text-korintek-ink text-center mb-1">Bienvenue</h1>
          <p className="text-sm text-slate-500 text-center mb-6">Connectez-vous pour accéder au CRM</p>

          {(urlError || error) && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4 text-center">
              {ERROR_MESSAGES[urlError] || error}
            </p>
          )}

          <a
            href={`${apiBase}/auth/microsoft`}
            className="w-full flex items-center justify-center gap-2 border border-slate-300 rounded-lg py-2.5 font-medium text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Se connecter avec Microsoft 365
          </a>

          <p className="text-xs text-slate-400 text-center mt-4">Connexion réservée aux comptes KORINTEK Office 365.</p>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowLocalForm((v) => !v)}
              className="text-xs text-slate-400 hover:text-slate-600 w-full text-center"
            >
              {showLocalForm ? 'Masquer' : "Compte de secours (accès local)"}
            </button>

            {showLocalForm && (
              <form onSubmit={handleLocalLogin} className="mt-4 space-y-3">
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  required
                  placeholder="Mot de passe"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-korintek-navy text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400 text-center mt-6 tracking-wide uppercase">Certifications Change Lives</p>
      </div>
    </div>
  );
}
