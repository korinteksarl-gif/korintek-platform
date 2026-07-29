// Badge KORINTEK — utilise le vrai logo officiel (fichier public/logo-korintek.png),
// affiché de façon cohérente sur tous les écrans de l'application.
export default function Logo({ size = 40, showWordmark = true, dark = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo-korintek.png"
        alt="KORINTEK"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full"
      />
      {showWordmark && (
        <div className="leading-tight">
          <p className={`font-heading font-extrabold tracking-tight text-base ${dark ? 'text-white' : 'text-korintek-ink'}`}>
            KORINTEK
          </p>
          <p className={`text-[10px] font-medium tracking-wide uppercase ${dark ? 'text-white/60' : 'text-slate-400'}`}>
            Queue Manager
          </p>
        </div>
      )}
    </div>
  );
}
