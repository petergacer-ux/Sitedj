import { entreprise } from "@/content/site";

/** Bandeau des trois métiers. */
export function Metiers() {
  const colors = ["text-gold", "text-magenta-soft", "text-cyan"];
  return (
    <section aria-label="Nos métiers" className="relative border-y border-line bg-night-900/60">
      <ul className="container-stage flex flex-col items-center justify-center gap-2 py-10 sm:flex-row sm:gap-0">
        {entreprise.metiers.map((m, i) => (
          <li key={m} className="flex items-center">
            {i > 0 && <span aria-hidden className="mx-6 hidden size-1.5 rounded-full bg-ink-faint sm:block lg:mx-10" />}
            <span className={`font-display text-[clamp(1.4rem,3.6vw,2.6rem)] font-semibold uppercase tracking-[0.04em] ${colors[i % 3]}`}>
              {m}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
