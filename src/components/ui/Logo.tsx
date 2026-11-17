import { entreprise } from "@/content/site";

/** Logo typographique (remplacé automatiquement par entreprise.logo s'il est renseigné). */
export function Logo({ className = "" }: { className?: string }) {
  if (entreprise.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={entreprise.logo} alt={entreprise.nom} className={`h-9 w-auto ${className}`} />;
  }
  return (
    <span className={`flex items-baseline gap-2 ${className}`}>
      <span className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">Millenium</span>
      <span className="font-serif text-lg italic text-gold">DJ Animation</span>
    </span>
  );
}
