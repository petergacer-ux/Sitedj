"use client";

import { useEffect, useRef } from "react";
import { useCanvasLoop } from "@/lib/canvas";
import { lightRGB, type LightName } from "@/styles/tokens";

type Beam = {
  x: number; // position relative 0..1
  color: LightName;
  speed: number;
  phase: number;
  amp: number;
  base: number;
  width: number;
};

const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function makeBeams(count: number): Beam[] {
  const palette: LightName[] = ["gold", "magenta", "gold", "cyan", "magenta", "gold", "magenta", "gold"];
  return Array.from({ length: count }, (_, i) => {
    const x = (i + 0.5) / count;
    return {
      x,
      color: palette[i % palette.length],
      speed: 0.35 + ((i * 37) % 10) / 28,
      phase: i * 1.7,
      amp: 0.32 + ((i * 13) % 7) / 40,
      base: (0.5 - x) * 0.9, // les lyres extérieures visent vers le centre
      width: 0.09 + ((i * 7) % 5) / 120,
    };
  });
}

/**
 * Faisceaux de lyres qui balayent la scène, sur une brume légère.
 * Canvas 2D, rendu additif. Suit légèrement la souris.
 */
export function StageBeams({ reduced, intensity = 1 }: { reduced: boolean; intensity?: number }) {
  const beams = useRef<Beam[]>(makeBeams(6));
  const mouse = useRef({ x: 0, tx: 0, y: 0, ty: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mouse.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const ref = useCanvasLoop(
    ({ ctx, w, h, t }) => {
      const m = mouse.current;
      m.x += (m.tx - m.x) * 0.04;
      m.y += (m.ty - m.y) * 0.04;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // Brume : nappes lumineuses qui dérivent lentement
      const haze: [LightName, number, number, number][] = [
        ["magenta", 0.2, 0.75, 0.11],
        ["gold", 0.75, 0.65, 0.09],
        ["cyan", 0.55, 0.95, 0.05],
        ["violet", 0.1, 0.35, 0.06],
      ];
      for (let i = 0; i < haze.length; i++) {
        const [c, hx, hy, a] = haze[i];
        const cx = (hx + Math.sin(t * 0.07 + i * 2) * 0.12) * w;
        const cy = (hy + Math.cos(t * 0.05 + i) * 0.06) * h;
        const r = Math.max(w, h) * 0.55;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, rgba(lightRGB[c], a * intensity));
        g.addColorStop(1, rgba(lightRGB[c], 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Faisceaux
      const len = Math.hypot(w, h) * 1.15;
      const list = beams.current;
      const count = w < 640 ? 4 : list.length;
      for (let i = 0; i < count; i++) {
        const b = list[i];
        const ox = (count === list.length ? b.x : (i + 0.5) / count) * w;
        const oy = -h * 0.04;
        const sweep = Math.sin(t * b.speed + b.phase) * b.amp + Math.sin(t * b.speed * 0.37 + b.phase * 2) * 0.12;
        const angle = Math.PI / 2 + b.base + sweep - m.x * 0.28 * (1 - Math.abs(b.base));
        const spread = b.width * (1 + m.y * 0.15);
        const col = lightRGB[b.color];
        const pulse = 0.75 + 0.25 * Math.sin(t * 2.1 + b.phase);

        for (const [k, alpha] of [[2.4, 0.07], [1, 0.16], [0.35, 0.22]] as const) {
          const a1 = angle - spread * k;
          const a2 = angle + spread * k;
          const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(angle) * len, oy + Math.sin(angle) * len);
          g.addColorStop(0, rgba(col, alpha * 1.6 * pulse * intensity));
          g.addColorStop(0.45, rgba(col, alpha * 0.55 * pulse * intensity));
          g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(a1) * len, oy + Math.sin(a1) * len);
          ctx.lineTo(ox + Math.cos(a2) * len, oy + Math.sin(a2) * len);
          ctx.closePath();
          ctx.fill();
        }

        // Tache au sol
        const hitX = ox + Math.cos(angle) * ((h * 0.92 - oy) / Math.max(0.2, Math.sin(angle)));
        if (hitX > -w * 0.3 && hitX < w * 1.3) {
          const fy = h * 0.92;
          const r = w * 0.09;
          const g = ctx.createRadialGradient(hitX, fy, 0, hitX, fy, r);
          g.addColorStop(0, rgba(col, 0.22 * pulse * intensity));
          g.addColorStop(1, rgba(col, 0));
          ctx.save();
          ctx.translate(hitX, fy);
          ctx.scale(1, 0.28);
          ctx.translate(-hitX, -fy);
          ctx.fillStyle = g;
          ctx.fillRect(hitX - r, fy - r, r * 2, r * 2);
          ctx.restore();
        }

        // Source lumineuse (la lyre)
        const sg = ctx.createRadialGradient(ox, 0, 0, ox, 0, 46);
        sg.addColorStop(0, rgba(lightRGB.white, 0.75 * intensity));
        sg.addColorStop(0.25, rgba(col, 0.45 * intensity));
        sg.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = sg;
        ctx.fillRect(ox - 46, -46, 92, 92);
      }

      ctx.globalCompositeOperation = "source-over";
    },
    { reduced, maxDpr: 1.25 },
  );

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
