/** Égaliseur de barres qui pulse comme une basse (CSS pur, transform uniquement). */
export function Equalizer({ bars = 40, className = "" }: { bars?: number; className?: string }) {
  return (
    <div aria-hidden className={`flex h-full items-end justify-center gap-[3px] sm:gap-[5px] ${className}`}>
      {Array.from({ length: bars }, (_, i) => {
        // pseudo-aléatoire déterministe (pas d'écart serveur / client)
        const r = ((i * 9301 + 49297) % 233280) / 233280;
        const center = 1 - Math.abs(i - (bars - 1) / 2) / (bars / 2);
        const isBass = i % 7 === 3 || i % 11 === 5;
        const max = 0.35 + center * 0.6 * (0.6 + r * 0.4);
        const style = {
          "--eq-min": (0.08 + r * 0.12).toFixed(2),
          "--eq-max": max.toFixed(2),
          animation: isBass
            ? `kick 0.5s cubic-bezier(.2,.8,.3,1) ${(-(r * 0.5)).toFixed(2)}s infinite`
            : `eq ${(0.38 + r * 0.7).toFixed(2)}s ease-in-out ${(-r * 2).toFixed(2)}s infinite`,
          transform: `scaleY(${(0.2 + center * 0.5).toFixed(2)})`,
        } as React.CSSProperties;
        return (
          <span
            key={i}
            className="block h-full w-[3px] origin-bottom rounded-full bg-gradient-to-t from-magenta via-gold to-gold-soft opacity-90 sm:w-[5px]"
            style={style}
          />
        );
      })}
    </div>
  );
}
