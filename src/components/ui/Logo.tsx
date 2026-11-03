import { entreprise } from "@/content/site";

/** Logo typographique (remplacé automatiquement par entreprise.logo s'il est renseigné). */
export function Logo({ className = "" }: { className?: string }) {
  if (entreprise.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={entreprise.logo} alt={entreprise.nom} className={`h-10 w-auto ${className}`} />;
  }
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <span aria-hidden className="relative grid size-9 place-items-center rounded-full bg-[conic-gradient(from_200deg,var(--c-gold),var(--c-magenta),var(--c-navy),var(--c-gold))] p-[2px]">
        <span className="grid size-full place-items-center rounded-full bg-night-950">
          <span className="size-2 rounded-full bg-gold shadow-[0_0_10px_var(--c-gold)]" />
        </span>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[0.95rem] font-bold tracking-[0.12em] text-ink">MILLENIUM</span>
        <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.38em] text-gold">DJ Animation</span>
      </span>
    </span>
  );
}
