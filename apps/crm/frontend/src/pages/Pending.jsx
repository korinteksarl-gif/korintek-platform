import Logo from '../components/Logo.jsx';

export default function Pending() {
  function logout() {
    localStorage.removeItem('korintek_crm_token');
    localStorage.removeItem('korintek_crm_user');
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen bg-korintek-tealLighter flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-card p-8 max-w-sm text-center">
        <div className="flex justify-center mb-6"><Logo size={48} /></div>
        <h1 className="font-heading font-bold text-lg text-korintek-ink mb-2">Compte créé</h1>
        <p className="text-sm text-slate-600 mb-6">
          Votre compte Microsoft 365 a bien été reconnu, mais aucun rôle ne vous a encore été attribué.
          Contactez un administrateur KORINTEK pour activer votre accès.
        </p>
        <button onClick={logout} className="text-sm text-korintek-tealDark hover:underline">
          Retour à la connexion
        </button>
      </div>
    </div>
  );
}
