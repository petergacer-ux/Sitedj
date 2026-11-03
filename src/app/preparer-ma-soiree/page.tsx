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
        <p className="eyebrow mb-4 flex items-center gap-3"><span className="h-px w-8 bg-gold/60" aria-hidden />Questionnaire</p>
        <h1 className="font-display text-[clamp(2.4rem,7vw,5rem)] font-bold leading-[0.95] tracking-[-0.03em]">
          Préparer <span className="text-gradient">ma soirée</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted">{questionnaire.intro}</p>
        <div className="mt-12">
          <Questionnaire />
        </div>
      </div>
    </section>
  );
}
