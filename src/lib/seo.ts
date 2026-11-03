import { entreprise, faq } from "@/content/site";
import { isMissing } from "@/components/ui/Fill";

export const siteUrl =
  entreprise.urlSite ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

/** Données structurées (uniquement des informations réelles). */
export function jsonLd() {
  const business = {
    "@context": "https://schema.org",
    "@type": "EntertainmentBusiness",
    name: entreprise.nom,
    slogan: entreprise.slogan,
    description: `${entreprise.metiers.join(", ")} pour ${entreprise.evenements.join(", ").toLowerCase()}.`,
    telephone: "+33680656463",
    email: entreprise.email,
    url: siteUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: entreprise.adresse.rue,
      postalCode: entreprise.adresse.codePostal,
      addressLocality: entreprise.adresse.ville,
      addressRegion: entreprise.adresse.departement,
      addressCountry: "FR",
    },
    ...(entreprise.reseaux.length ? { sameAs: entreprise.reseaux.map((r) => r.url) } : {}),
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.questions
      .filter((q) => !isMissing(q.r))
      .map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.r } })),
  };
  return [business, faqLd];
}
