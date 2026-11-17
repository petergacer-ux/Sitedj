import { entreprise } from "@/content/site";

/** Bandeau des trois métiers. */
export function Metiers() {
  return (
    <section aria-label="Nos métiers" className="border-y border-line">
      <ul className="container-stage grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {entreprise.metiers.map((m, i) => (
          <li key={m} className="flex items-baseline gap-4 py-8 sm:justify-center">
            <span className="font-serif text-lg italic text-gold">0{i + 1}</span>
            <span className="font-display text-2xl font-medium tracking-[-0.03em] sm:text-3xl">{m}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
