"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { faq } from "@/content/site";
import { SectionHeading } from "@/components/ui/Reveal";
import { Fill } from "@/components/ui/Fill";
import { motion as tk } from "@/styles/tokens";

function Item({ q, r, defaultOpen }: { q: string; r: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const id = useId();
  return (
    <li className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full items-center justify-between gap-6 py-6 text-left"
        >
          <span className="font-display text-lg font-medium transition-colors group-hover:text-gold sm:text-xl">{q}</span>
          <span aria-hidden className={`relative grid size-9 shrink-0 place-items-center rounded-full border border-line transition-all duration-300 ${open ? "rotate-45 border-gold bg-gold text-night-950" : "text-gold"}`}>
            <span className="absolute h-px w-3.5 bg-current" />
            <span className="absolute h-3.5 w-px bg-current" />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: tk.easeArray }}
            className="overflow-hidden"
          >
            <p className="max-w-3xl pb-7 text-ink-muted text-pretty"><Fill text={r} /></p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-titre" className="relative section-pad">
      <div className="container-stage grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading titleId="faq-titre" eyebrow={faq.surTitre} title={faq.titre} />
        </div>
        <ul className="border-t border-line">
          {faq.questions.map((f, i) => (
            <Item key={f.q} q={f.q} r={f.r} defaultOpen={i === 0} />
          ))}
        </ul>
      </div>
    </section>
  );
}
