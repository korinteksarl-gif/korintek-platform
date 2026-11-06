import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const ticket = searchParams.get('ticket');
    const legacyToken = searchParams.get('token');
    window.history.replaceState(null, '', window.location.pathname);
    if (!ticket && !legacyToken) {
      navigate('/login?error=missing_code');
      return;
    }

    (ticket ? apiClient.post('/auth/exchange', { ticket }).then(({ data }) => data.token) : Promise.resolve(legacyToken))
      .then((token) => {
        localStorage.setItem('korintek_compta_token', token);
        return apiClient.get('/auth/me');
      })
      .then(({ data }) => {
        localStorage.setItem('korintek_compta_user', JSON.stringify(data.user));
        navigate(data.user.role === 'PENDING' ? '/pending' : '/journal');
      })
      .catch(() => {
        localStorage.removeItem('korintek_compta_token');
        navigate('/login?error=profile_fetch_failed');
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-400">Connexion en cours...</p>
    </div>
  );
}
