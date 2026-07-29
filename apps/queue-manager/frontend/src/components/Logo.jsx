// Badge KORINTEK — monogramme circulaire dans la couleur de marque exacte (#00BAD2,
// extraite du logo officiel). Utilisé en en-tête de chaque écran pour une identité
// visuelle cohérente avec korintek.com.
export default function Logo({ size = 40, showWordmark = true, dark = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="19" fill="none" stroke="#00BAD2" strokeWidth="2" />
        <text
          x="20"
          y="27"
          textAnchor="middle"
          fontFamily="Manrope, sans-serif"
          fontWeight="800"
          fontSize="18"
          fill="#00BAD2"
        >
          K
        </text>
      </svg>
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
