"use client";

import { useRef } from "react";
import { useCanvasLoop } from "@/lib/canvas";
import { lightRGB } from "@/styles/tokens";
import type { TypeEffet } from "@/content/types";

type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number; rot: number };

const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Sprite de fumée pré-rendu (une seule fois) pour des performances optimales. */
let smokeSprite: HTMLCanvasElement | null = null;
function getSmokeSprite() {
  if (smokeSprite) return smokeSprite;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(235,238,255,0.55)");
  grd.addColorStop(0.4, "rgba(220,225,250,0.25)");
  grd.addColorStop(1, "rgba(220,225,250,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  smokeSprite = c;
  return c;
}

/**
 * Aperçu animé d'un effet (fumée, étincelles, ondes, notes, projecteur).
 * `emitting` : on émet de nouvelles particules ; `running` : la boucle tourne
 * (on la laisse tourner un peu après l'arrêt pour que les particules s'éteignent).
 */
export function EffectCanvas({
  effet,
  emitting,
  running,
  reduced,
}: {
  effet: TypeEffet;
  emitting: boolean;
  running: boolean;
  reduced: boolean;
}) {
  const parts = useRef<P[]>([]);
  const acc = useRef(0);
  const emitRef = useRef(emitting);
  emitRef.current = emitting;

  const ref = useCanvasLoop(
    ({ ctx, w, h, t, dt }) => {
      ctx.clearRect(0, 0, w, h);
      if (dt === 0) return;
      const ps = parts.current;
      const emit = emitRef.current;

      switch (effet) {
        case "fumee": {
          if (emit) {
            acc.current += dt * 26;
            while (acc.current > 1) {
              acc.current--;
              ps.push({
                x: Math.random() * w,
                y: h + 30,
                vx: (Math.random() - 0.5) * 14,
                vy: -(45 + Math.random() * 70),
                life: 0,
                max: 3.8 + Math.random() * 2.2,
                size: 70 + Math.random() * 90,
                hue: 0,
                rot: Math.random() * Math.PI,
              });
            }
          }
          const sprite = getSmokeSprite();
          for (let i = ps.length - 1; i >= 0; i--) {
            const p = ps[i];
            p.life += dt;
            if (p.life > p.max) {
              ps.splice(i, 1);
              continue;
            }
            p.x += (p.vx + Math.sin(t * 0.8 + p.rot) * 8) * dt;
            p.y += p.vy * dt;
            p.vy *= 0.993;
            const k = p.life / p.max;
            const s = p.size * (0.6 + k * 1.2);
            ctx.globalAlpha = Math.sin(Math.PI * k) * 0.55;
            ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
          }
          ctx.globalAlpha = 1;
          break;
        }

        case "etincelles": {
          if (emit) {
            acc.current += dt * 260;
            const sources = w > 260 ? [0.28, 0.72] : [0.5];
            while (acc.current > 1) {
              acc.current--;
              const sx = sources[Math.floor(Math.random() * sources.length)] * w;
              const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.32;
              const sp = h * (0.9 + Math.random() * 0.75);
              ps.push({ x: sx, y: h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.9 + Math.random() * 0.8, size: 1 + Math.random() * 1.6, hue: Math.random(), rot: 0 });
            }
          }
          ctx.globalCompositeOperation = "lighter";
          ctx.lineCap = "round";
          for (let i = ps.length - 1; i >= 0; i--) {
            const p = ps[i];
            p.life += dt;
            if (p.life > p.max || p.y > h + 10) {
              ps.splice(i, 1);
              continue;
            }
            const px = p.x, py = p.y;
            p.vy += h * 1.6 * dt; // gravité
            p.vx *= 0.99;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const k = 1 - p.life / p.max;
            const c = p.hue > 0.7 ? lightRGB.white : lightRGB.gold;
            ctx.strokeStyle = rgba(c, k);
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
          // lueur de la base
          if (emit) {
            const g = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, w * 0.6);
            g.addColorStop(0, rgba(lightRGB.gold, 0.35));
            g.addColorStop(1, rgba(lightRGB.gold, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.globalCompositeOperation = "source-over";
          break;
        }

        case "ondes": {
          if (emit) {
            acc.current += dt * 1.6;
            if (acc.current > 1) {
              acc.current = 0;
              ps.push({ x: w * 0.82, y: h * 0.22, vx: 0, vy: 0, life: 0, max: 2.4, size: 0, hue: Math.random(), rot: 0 });
            }
          }
          ctx.globalCompositeOperation = "lighter";
          for (let i = ps.length - 1; i >= 0; i--) {
            const p = ps[i];
            p.life += dt;
            if (p.life > p.max) {
              ps.splice(i, 1);
              continue;
            }
            const k = p.life / p.max;
            ctx.strokeStyle = rgba(p.hue > 0.5 ? lightRGB.cyan : lightRGB.magenta, (1 - k) * 0.7);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8 + k * Math.max(w, h) * 0.9, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
          break;
        }

        case "notes": {
          if (emit) {
            acc.current += dt * 5;
            while (acc.current > 1) {
              acc.current--;
              ps.push({ x: Math.random() * w, y: h + 20, vx: (Math.random() - 0.5) * 10, vy: -(30 + Math.random() * 40), life: 0, max: 3 + Math.random() * 1.5, size: 16 + Math.random() * 16, hue: Math.random(), rot: (Math.random() - 0.5) * 0.6 });
            }
          }
          ctx.textAlign = "center";
          for (let i = ps.length - 1; i >= 0; i--) {
            const p = ps[i];
            p.life += dt;
            if (p.life > p.max) {
              ps.splice(i, 1);
              continue;
            }
            p.x += (p.vx + Math.sin(t * 2 + p.rot * 10) * 14) * dt;
            p.y += p.vy * dt;
            const k = p.life / p.max;
            ctx.globalAlpha = Math.sin(Math.PI * k);
            ctx.fillStyle = p.hue > 0.5 ? "#f3c66b" : "#ff7ab8";
            ctx.font = `${p.size}px serif`;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillText(p.hue > 0.66 ? "♫" : p.hue > 0.33 ? "♪" : "♩", 0, 0);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
          break;
        }

        case "projecteur": {
          // fondu d'intensité géré via une particule unique
          if (!ps.length) ps.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 0, hue: 0, rot: 0 });
          const p = ps[0];
          p.size += ((emit ? 1 : 0) - p.size) * Math.min(1, dt * 4);
          const I = p.size;
          if (I < 0.01) break;
          const ox = w * 0.08, oy = h * 0.12;
          const sx = w * 0.42, sy = h * 0.14, sw = w * 0.5, sh = h * 0.42;
          ctx.globalCompositeOperation = "lighter";
          const g = ctx.createLinearGradient(ox, oy, sx + sw / 2, sy + sh / 2);
          g.addColorStop(0, rgba(lightRGB.white, 0.35 * I));
          g.addColorStop(1, rgba(lightRGB.cyan, 0.06 * I));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(sx, sy);
          ctx.lineTo(sx, sy + sh);
          ctx.closePath();
          ctx.fill();
          const flick = 0.85 + Math.sin(t * 23) * 0.05 + Math.sin(t * 7) * 0.05;
          const sg = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
          sg.addColorStop(0, rgba(lightRGB.magenta, 0.35 * I * flick));
          sg.addColorStop(0.5, rgba(lightRGB.gold, 0.3 * I * flick));
          sg.addColorStop(1, rgba(lightRGB.cyan, 0.35 * I * flick));
          ctx.fillStyle = sg;
          ctx.fillRect(sx, sy, sw, sh);
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = rgba(lightRGB.white, 0.4 * I);
          ctx.strokeRect(sx, sy, sw, sh);
          ctx.fillStyle = rgba(lightRGB.white, 0.9 * I);
          ctx.beginPath();
          ctx.arc(ox, oy, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case "eclairage":
          // L'éclairage agit sur la lumière ambiante de la section (voir Effets.tsx)
          break;
      }
    },
    { active: running, reduced, maxDpr: 1.5 },
  );

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
