"use client";

import Link from "next/link";
import { useState } from "react";
import { devis, entreprise, formulaires, hero } from "@/content/site";
import { SectionHeading, FadeIn } from "@/components/ui/Reveal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { MagneticButton } from "@/components/ui/Magnetic";
import { PhoneIcon } from "@/components/Header";
import { submitForm, type SubmitResult } from "@/lib/submit";
import { Arrow } from "./Hero";

export function Devis() {
  const [status, setStatus] = useState<"idle" | "sending" | SubmitResult>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (fd.get("site_web")) return; // pot de miel anti-spam
    const g = (k: string) => String(fd.get(k) ?? "");
    setStatus("sending");
    const res = await submitForm(
      `Demande de devis — ${g("type") || "Événement"} — ${g("nom")}`,
      {
        Formulaire: "Demande de devis",
        Nom: g("nom"),
        Email: g("email"),
        Téléphone: g("tel"),
        "Type d'événement": g("type"),
        Date: g("date"),
        Lieu: g("lieu"),
        "Nombre d'invités": g("invites"),
        Message: g("message"),
      },
      g("email"),
    );
    setStatus(res);
    if (res === "sent") form.reset();
  }

  const adresse = `${entreprise.adresse.rue}, ${entreprise.adresse.codePostal} ${entreprise.adresse.ville}`;

  return (
    <section id="devis" aria-labelledby="devis-titre" className="relative isolate section-pad overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_20%_0%,rgb(var(--rgb-gold)/.14),transparent_70%),radial-gradient(50%_60%_at_100%_100%,rgb(var(--rgb-magenta)/.18),transparent_70%)]" />
      <div className="container-stage grid gap-14 lg:grid-cols-[1fr_1.25fr] lg:gap-20">
        <div>
          <SectionHeading titleId="devis-titre" eyebrow={devis.surTitre} title={devis.titre} intro={devis.intro} />

          <FadeIn delay={0.1}>
            <ul className="mt-10 space-y-3">
              <li>
                <a href={entreprise.telephoneLien} className="group glass flex items-center gap-4 rounded-lg p-5 transition-shadow hover:shadow-glow-gold">
                  <span className="grid size-11 place-items-center rounded-full bg-gold text-night-950"><PhoneIcon /></span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.2em] text-ink-faint">Téléphone</span>
                    <span className="font-display text-xl font-semibold group-hover:text-gold">{entreprise.telephone}</span>
                  </span>
                </a>
              </li>
              <li>
                <a href={`mailto:${entreprise.email}`} className="group glass flex items-center gap-4 rounded-lg p-5 transition-shadow hover:shadow-glow-magenta">
                  <span className="grid size-11 place-items-center rounded-full bg-magenta text-ink">
                    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18v12H3z" /><path d="m3 7 9 6 9-6" /></svg>
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.2em] text-ink-faint">E-mail</span>
                    <span className="font-display text-lg font-semibold break-all group-hover:text-magenta-soft">{entreprise.email}</span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group glass flex items-center gap-4 rounded-lg p-5 transition-shadow hover:shadow-glow-cyan"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-cyan text-night-950">
                    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.2em] text-ink-faint">Adresse</span>
                    <address className="not-italic text-ink/90">
                      {entreprise.adresse.rue}<br />
                      {entreprise.adresse.codePostal} {entreprise.adresse.ville} ({entreprise.adresse.departement})
                    </address>
                  </span>
                </a>
              </li>
            </ul>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 rounded-lg border border-dashed border-gold/40 p-6">
              <p className="font-display text-lg font-semibold text-gold">{devis.encartQuestionnaire.titre}</p>
              <p className="mt-2 text-sm text-ink-muted">{devis.encartQuestionnaire.texte}</p>
              <Link href={hero.ctaSecondaire.href} className="mt-4 inline-flex items-center gap-2 font-display text-xs uppercase tracking-[0.18em] text-gold hover:underline underline-offset-8">
                {devis.encartQuestionnaire.bouton} →
              </Link>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.1}>
          <form onSubmit={onSubmit} className="glass relative rounded-xl p-6 shadow-soft sm:p-10" noValidate={false}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input id="nom" label="Nom et prénom" required autoComplete="name" />
              <Input id="tel" label="Téléphone" type="tel" autoComplete="tel" inputMode="tel" />
              <Input id="email" label="E-mail" type="email" required autoComplete="email" className="sm:col-span-2" />
              <Select id="type" label="Type d'événement" options={devis.typesEvenement} required />
              <Input id="date" label="Date de l'événement" type="date" />
              <Input id="lieu" label="Lieu (ville ou salle)" />
              <Input id="invites" label="Nombre d'invités" type="number" min={1} inputMode="numeric" />
              <Textarea id="message" label="Votre projet en quelques mots" rows={5} className="sm:col-span-2" placeholder="Ambiance souhaitée, horaires, options qui vous intéressent…" />
            </div>
            {/* pot de miel anti-spam, invisible */}
            <input type="text" name="site_web" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />

            <p className="mt-5 text-xs text-ink-faint">{devis.mentionRGPD}</p>

            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
              <MagneticButton type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Envoi…" : devis.boutonEnvoi}
                <Arrow />
              </MagneticButton>
            </div>

            <div aria-live="polite" className="mt-5 min-h-6 text-sm">
              {status === "sent" && <p className="text-gold">{formulaires.messageSucces}</p>}
              {status === "mailto" && (
                <p className="text-ink-muted">
                  Votre messagerie s&apos;ouvre avec la demande pré-remplie : il ne reste qu&apos;à l&apos;envoyer. Rien ne s&apos;ouvre ? Écrivez à{" "}
                  <a className="text-gold underline" href={`mailto:${entreprise.email}`}>{entreprise.email}</a>.
                </p>
              )}
              {status === "error" && <p className="text-magenta-soft">{formulaires.messageErreur}</p>}
            </div>
          </form>
        </FadeIn>
      </div>
    </section>
  );
}
