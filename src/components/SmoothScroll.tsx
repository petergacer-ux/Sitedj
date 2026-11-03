"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollState } from "@/lib/scroll";

gsap.registerPlugin(ScrollTrigger);

/** Défilement fluide (Lenis) synchronisé avec GSAP ScrollTrigger. */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let lastY = window.scrollY;
    const tickVelocity = () => {
      // Vitesse lissée, utilisée par le vinyle et les bandeaux.
      const y = window.scrollY;
      const raw = y - lastY;
      lastY = y;
      scrollState.velocity += (raw - scrollState.velocity) * 0.18;
    };

    if (reduced) {
      gsap.ticker.add(tickVelocity);
      return () => gsap.ticker.remove(tickVelocity);
    }

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: { offset: -20 },
    });
    scrollState.lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
      tickVelocity();
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Arrivée sur /#section depuis une autre page
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) setTimeout(() => lenis.scrollTo(el as HTMLElement, { offset: -20, immediate: true }), 50);
    }

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      scrollState.lenis = null;
    };
  }, []);

  return null;
}
