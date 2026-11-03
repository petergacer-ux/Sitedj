import type { Metadata } from "next";
import { entreprise, mentionsLegales } from "@/content/site";
import { Fill } from "@/components/ui/Fill";

export const metadata: Metadata = { title: "Mentions légales", robots: { index: false }, alternates: { canonical: "/mentions-legales/" } };

export default function MentionsLegales() {
  const rows: [string, string][] = [
    ["Raison sociale", mentionsLegales.raisonSociale],
    ["Nom commercial", entreprise.nom],
    ["Forme juridique", mentionsLegales.formeJuridique],
    ["SIRET", mentionsLegales.siret],
    ["Adresse", `${entreprise.adresse.rue}, ${entreprise.adresse.codePostal} ${entreprise.adresse.ville}`],
    ["Téléphone", entreprise.telephone],
    ["E-mail", entreprise.email],
    ["Responsable de la publication", mentionsLegales.responsablePublication],
    ["Hébergeur", mentionsLegales.hebergeur],
  ];
  return (
    <section className="container-stage max-w-3xl pb-24 pt-36">
      <p className="eyebrow mb-4">Informations</p>
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Mentions légales</h1>
      <dl className="mt-12 divide-y divide-line border-y border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr]">
            <dt className="text-sm text-ink-faint">{k}</dt>
            <dd className="text-ink/90"><Fill text={v} /></dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-14 font-display text-2xl font-semibold">Données personnelles</h2>
      <p className="mt-4 text-ink-muted">
        Les informations transmises via les formulaires du site servent uniquement à répondre à votre demande et à préparer votre événement.
        Elles ne sont ni revendues ni cédées. Vous pouvez demander leur consultation, rectification ou suppression à tout moment en écrivant à{" "}
        <a className="text-gold underline" href={`mailto:${entreprise.email}`}>{entreprise.email}</a>.
      </p>
      <p className="mt-4 text-ink-muted">
        Le questionnaire « Préparer ma soirée » enregistre vos réponses dans votre navigateur (stockage local) pour que vous puissiez y revenir ; elles ne quittent votre appareil que lorsque vous les envoyez.
        Ce site n&apos;utilise pas de cookies publicitaires ni de mesure d&apos;audience.
      </p>
    </section>
  );
}
