import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('korintek_compta_token');
  const user = JSON.parse(localStorage.getItem('korintek_compta_user') || 'null');

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl shadow-card p-8 max-w-sm text-center">
          <h1 className="font-heading font-bold text-lg text-korintek-ink mb-2">Accès non autorisé</h1>
          <p className="text-sm text-slate-500">
            Votre rôle actuel ({user.role}) ne permet pas d'accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
