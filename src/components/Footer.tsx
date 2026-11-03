import Link from "next/link";
import { entreprise, navigation, piedDePage, hero } from "@/content/site";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-night-950">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div className="container-stage grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm text-sm text-ink-muted">« {entreprise.slogan} »<br />{piedDePage.texte}</p>
          <p className="mt-4 text-sm text-ink-faint">{entreprise.evenements.join(" · ")}</p>
        </div>
        <nav aria-label="Pied de page">
          <p className="eyebrow mb-4">Le site</p>
          <ul className="space-y-2 text-sm">
            {navigation.map((n) => (
              <li key={n.href}><Link className="text-ink-muted hover:text-gold" href={n.href}>{n.label}</Link></li>
            ))}
            <li><Link className="text-ink-muted hover:text-gold" href={hero.ctaSecondaire.href}>{hero.ctaSecondaire.label}</Link></li>
          </ul>
        </nav>
        <div>
          <p className="eyebrow mb-4">Contact</p>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li><a className="hover:text-gold" href={entreprise.telephoneLien}>{entreprise.telephone}</a></li>
            <li><a className="hover:text-gold break-all" href={`mailto:${entreprise.email}`}>{entreprise.email}</a></li>
            <li>
              <address className="not-italic">
                {entreprise.adresse.rue}<br />{entreprise.adresse.codePostal} {entreprise.adresse.ville}
              </address>
            </li>
            {entreprise.reseaux.map((r) => (
              <li key={r.url}><a className="hover:text-gold" href={r.url} target="_blank" rel="noopener noreferrer">{r.nom}</a></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="container-stage flex flex-col justify-between gap-3 border-t border-line py-6 text-xs text-ink-faint sm:flex-row">
        <p>© {new Date().getFullYear()} {entreprise.nom}</p>
        <Link href="/mentions-legales/" className="hover:text-gold">Mentions légales</Link>
      </div>
    </footer>
  );
}
