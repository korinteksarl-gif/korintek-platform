import { useNavigate } from 'react-router-dom';

export default function Logo({ size = 40, showWordmark = true, dark = false }) {
  const navigate = useNavigate();

  function goHome() {
    const isConnected = !!localStorage.getItem('korintek_compta_token');
    navigate(isConnected ? '/journal' : '/login');
  }

  return (
    <button
      onClick={goHome}
      className="flex items-center gap-2.5 cursor-pointer bg-transparent border-0 p-0"
      aria-label="Retour à l'accueil"
    >
      <img
        src="/logo-korintek.png"
        alt="KORINTEK"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full"
      />
      {showWordmark && (
        <div className="leading-tight text-left">
          <p className={`font-heading font-extrabold tracking-tight text-base ${dark ? 'text-white' : 'text-korintek-ink'}`}>
            KORINTEK
          </p>
          <p className={`text-[10px] font-medium tracking-wide uppercase ${dark ? 'text-white/60' : 'text-slate-400'}`}>
            Comptabilité
          </p>
        </div>
      )}
    </button>
  );
}
