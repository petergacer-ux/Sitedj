"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { entreprise, hero, navigation } from "@/content/site";
import { Logo } from "@/components/ui/Logo";
import { scrollState } from "@/lib/scroll";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (open) scrollState.lenis?.stop();
    else scrollState.lenis?.start();
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-night-950">
        Aller au contenu
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${
          scrolled || open ? "border-b border-line bg-night-950/70 backdrop-blur-xl" : "border-b border-transparent"
        }`}
      >
        <div className="container-stage flex h-16 items-center justify-between gap-6 sm:h-20">
          <Link href="/" aria-label={`${entreprise.nom} — accueil`} onClick={() => setOpen(false)}>
            <Logo />
          </Link>

          <nav aria-label="Navigation principale" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {navigation.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="rounded-full px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={entreprise.telephoneLien}
              className="hidden items-center gap-2 text-sm text-ink-muted transition-colors hover:text-gold md:flex"
            >
              <PhoneIcon /> {entreprise.telephone}
            </a>
            <Link
              href={hero.ctaPrincipal.href}
              className="hidden rounded-full bg-gold px-5 py-2.5 font-display text-[0.7rem] font-medium uppercase tracking-[0.14em] text-night-950 shadow-glow-gold transition-colors hover:bg-gold-soft sm:inline-flex"
            >
              Devis
            </Link>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="menu-mobile"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setOpen((o) => !o)}
              className="relative grid size-11 place-items-center rounded-full glass lg:hidden"
            >
              <span className={`absolute h-px w-5 bg-ink transition-transform duration-300 ${open ? "rotate-45" : "-translate-y-[4px]"}`} />
              <span className={`absolute h-px w-5 bg-ink transition-transform duration-300 ${open ? "-rotate-45" : "translate-y-[4px]"}`} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 flex flex-col bg-night-950/95 px-6 pb-10 pt-28 backdrop-blur-xl lg:hidden"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_80%_10%,rgb(var(--rgb-magenta)/.25),transparent),radial-gradient(60%_40%_at_10%_90%,rgb(var(--rgb-gold)/.18),transparent)]" />
            <nav aria-label="Menu mobile" className="relative">
              <ul className="flex flex-col gap-2">
                {[...navigation, { label: hero.ctaSecondaire.label, href: hero.ctaSecondaire.href }].map((n, i) => (
                  <motion.li
                    key={n.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i + 0.1 }}
                  >
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="block py-2 font-display text-3xl font-semibold text-ink"
                    >
                      {n.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <div className="relative mt-auto flex flex-col gap-3 text-ink-muted">
              <a href={entreprise.telephoneLien} className="flex items-center gap-2 text-lg text-gold">
                <PhoneIcon /> {entreprise.telephone}
              </a>
              <a href={`mailto:${entreprise.email}`}>{entreprise.email}</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function PhoneIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}
