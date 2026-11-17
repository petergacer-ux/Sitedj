import type { Metadata } from "next";
import { questionnaire } from "@/content/site";
import { Questionnaire } from "@/components/Questionnaire";
import { StageGlow } from "@/components/fx/StageGlow";

export const metadata: Metadata = {
  title: questionnaire.titre,
  description: questionnaire.intro,
  alternates: { canonical: "/preparer-ma-soiree/" },
};

export default function PreparerMaSoiree() {
  return (
    <section className="relative isolate min-h-screen overflow-hidden pb-24 pt-32 sm:pt-40">
      <StageGlow />
      <div className="container-stage max-w-4xl">
        <p className="eyebrow mb-4 flex items-center gap-2.5"><span className="size-1.5 rounded-full bg-gold" aria-hidden />Questionnaire</p>
        <h1 className="font-display text-[clamp(2.4rem,7vw,5rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
          Préparer <span className="font-serif font-normal italic tracking-normal text-gold">ma soirée</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted">{questionnaire.intro}</p>
        <div className="mt-12">
          <Questionnaire />
        </div>
      </div>
    </section>
  );
}
