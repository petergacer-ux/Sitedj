import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Metiers } from "@/components/sections/Metiers";
import { Prestations } from "@/components/sections/Prestations";
import { Deroule } from "@/components/sections/Deroule";
import { Effets } from "@/components/sections/Effets";
import { Musique } from "@/components/sections/Musique";
import { Galerie } from "@/components/sections/Galerie";
import { AvisClients } from "@/components/sections/AvisClients";
import { Faq } from "@/components/sections/Faq";
import { Devis } from "@/components/sections/Devis";
import { jsonLd } from "@/lib/seo";

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
      <Hero />
      <Metiers />
      <About />
      <Prestations />
      <Deroule />
      <Effets />
      <Musique />
      <Galerie />
      <AvisClients />
      <Faq />
      <Devis />
    </>
  );
}
