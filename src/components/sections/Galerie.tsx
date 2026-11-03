import { galerie } from "@/content/site";
import { SectionHeading, FadeIn } from "@/components/ui/Reveal";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

const spans = [
  "sm:col-span-2 sm:row-span-2",
  "",
  "",
  "sm:row-span-2",
  "",
  "sm:col-span-2",
];

export function Galerie() {
  if (!galerie.photos.length) return null;
  return (
    <section id="galerie" aria-labelledby="galerie-titre" className="relative section-pad">
      <div className="container-stage">
        <SectionHeading titleId="galerie-titre" eyebrow={galerie.surTitre} title={galerie.titre} />
        <div className="mt-14 grid auto-rows-[200px] grid-cols-1 gap-4 sm:auto-rows-[220px] sm:grid-cols-3 lg:grid-cols-4">
          {galerie.photos.map((p, i) => (
            <FadeIn key={i} delay={(i % 4) * 0.06} className={`${spans[i % spans.length]} overflow-hidden rounded-lg border border-line`}>
              <figure className="group relative h-full w-full overflow-hidden">
                <div className="h-full w-full transition-transform duration-[1200ms] ease-stage group-hover:scale-[1.04]">
                  <PhotoSlot photo={p} />
                </div>
              </figure>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
