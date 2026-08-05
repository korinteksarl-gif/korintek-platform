import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      navigate('/login?error=missing_code');
      return;
    }

    localStorage.setItem('korintek_crm_token', token);

    apiClient.get('/auth/me')
      .then(({ data }) => {
        localStorage.setItem('korintek_crm_user', JSON.stringify(data.user));
        if (data.user.role === 'PENDING') {
          navigate('/pending');
        } else {
          navigate('/pipeline');
        }
      })
      .catch(() => {
        localStorage.removeItem('korintek_crm_token');
        navigate('/login?error=profile_fetch_failed');
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-400">Connexion en cours...</p>
    </div>
  );
}
