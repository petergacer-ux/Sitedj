"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { devis, effets, entreprise, formulaires, musique, questionnaire } from "@/content/site";
import { Chip, Input, Select, Textarea } from "@/components/ui/Field";
import { MagneticButton } from "@/components/ui/Magnetic";
import { submitForm, toPlainText, type SubmitResult } from "@/lib/submit";
import { scrollState } from "@/lib/scroll";
import { motion as tk } from "@/styles/tokens";

const STORAGE_KEY = "millenium-preparer-ma-soiree-v1";

type Data = {
  noms: string;
  email: string;
  tel: string;
  type: string;
  date: string;
  salle: string;
  ville: string;
  invites: string;
  debut: string;
  fin: string;
  moments: string[];
  chansons: Record<string, string>;
  animations: string;
  gouts: Record<string, number>;
  incontournables: string;
  interdites: string;
  options: string[];
  remarques: string;
};

const empty: Data = {
  noms: "", email: "", tel: "", type: "", date: "", salle: "", ville: "", invites: "", debut: "", fin: "",
  moments: [], chansons: {}, animations: "", gouts: {}, incontournables: "", interdites: "", options: [], remarques: "",
};

const STEPS = ["Vous", "L'événement", "Le déroulé", "La musique", "Les options", "Récapitulatif"];

function toSummary(d: Data): Record<string, string> {
  const niveaux = questionnaire.niveauxGout;
  const gouts = musique.styles
    .filter((s) => d.gouts[s] !== undefined)
    .map((s) => `${s} → ${niveaux[d.gouts[s]]}`)
    .join(" | ");
  const chansons = Object.entries(d.chansons)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k} : ${v}`)
    .join(" | ");
  return {
    "Nom(s)": d.noms,
    Email: d.email,
    Téléphone: d.tel,
    "Type d'événement": d.type,
    Date: d.date,
    Salle: d.salle,
    Ville: d.ville,
    "Nombre d'invités": d.invites,
    "Heure de début": d.debut,
    "Heure de fin souhaitée": d.fin,
    "Moments à animer": d.moments.join(", "),
    "Chansons clés": chansons,
    "Animations prévues (jeux, vidéos, discours)": d.animations,
    "Goûts musicaux": gouts,
    "Incontournables": d.incontournables,
    "À ne pas passer": d.interdites,
    "Options souhaitées": d.options.join(", "),
    Remarques: d.remarques,
  };
}

export function Questionnaire() {
  const [data, setData] = useState<Data>(empty);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [status, setStatus] = useState<"idle" | "sending" | SubmitResult>("idle");
  const [loaded, setLoaded] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Restauration / sauvegarde automatique (localStorage)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData({ ...empty, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [data, loaded]);

  const set = <K extends keyof Data>(k: K, v: Data[K]) => setData((d) => ({ ...d, [k]: v }));
  const toggle = (k: "moments" | "options", v: string, on: boolean) =>
    setData((d) => ({ ...d, [k]: on ? [...d[k], v] : d[k].filter((x) => x !== v) }));

  const go = (n: number) => {
    if (n > step && formRef.current && !formRef.current.reportValidity()) return;
    setDir(n > step ? 1 : -1);
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    const el = top.current;
    if (el) {
      if (scrollState.lenis) scrollState.lenis.scrollTo(el, { offset: -110 });
      else el.scrollIntoView({ block: "start" });
    }
  };

  const summary = useMemo(() => toSummary(data), [data]);
  const text = useMemo(() => `Préparer ma soirée — ${entreprise.nom}\n\n${toPlainText(summary)}`, [summary]);

  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ma-soiree-${(data.noms || "millenium").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const send = async () => {
    setStatus("sending");
    const res = await submitForm(`Préparer ma soirée — ${data.type || "Événement"} — ${data.noms}`, summary, data.email);
    setStatus(res);
  };

  const reset = () => {
    if (!confirm("Effacer toutes vos réponses ?")) return;
    setData(empty);
    setStep(0);
    setStatus("idle");
  };

  return (
    <div ref={top}>
      {/* Progression */}
      <ol className="mb-8 grid grid-cols-6 gap-2" aria-label="Étapes du questionnaire">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => i < step && go(i)}
              aria-current={i === step ? "step" : undefined}
              disabled={i > step}
              className="group w-full text-left disabled:cursor-default"
            >
              <span className={`block h-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-gradient-to-r from-gold to-magenta" : "bg-line"}`} />
              <span className={`mt-2 hidden text-xs sm:block ${i === step ? "text-gold" : "text-ink-faint"}`}>{s}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm text-ink-faint sm:hidden">Étape {step + 1}/{STEPS.length} · <span className="text-gold">{STEPS[step]}</span></p>

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) go(step + 1);
        }}
        className="glass relative overflow-hidden rounded-xl p-6 shadow-soft sm:p-10"
      >
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.fieldset
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.4, ease: tk.easeArray }}
          >
            <legend className="mb-8 font-display text-2xl font-semibold sm:text-3xl">{STEPS[step]}</legend>

            {step === 0 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Input id="q-noms" label="Vos prénoms et noms" required value={data.noms} onChange={(e) => set("noms", e.target.value)} className="sm:col-span-2" autoComplete="name" />
                <Input id="q-email" type="email" label="E-mail" required value={data.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
                <Input id="q-tel" type="tel" label="Téléphone" value={data.tel} onChange={(e) => set("tel", e.target.value)} autoComplete="tel" />
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Select id="q-type" label="Type d'événement" options={devis.typesEvenement} required value={data.type} onChange={(e) => set("type", e.target.value)} />
                <Input id="q-date" type="date" label="Date" value={data.date} onChange={(e) => set("date", e.target.value)} />
                <Input id="q-salle" label="Nom de la salle / du lieu" value={data.salle} onChange={(e) => set("salle", e.target.value)} />
                <Input id="q-ville" label="Ville" value={data.ville} onChange={(e) => set("ville", e.target.value)} />
                <Input id="q-invites" type="number" min={1} label="Nombre d'invités" value={data.invites} onChange={(e) => set("invites", e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <Input id="q-debut" type="time" label="Début" value={data.debut} onChange={(e) => set("debut", e.target.value)} />
                  <Input id="q-fin" type="time" label="Fin souhaitée" value={data.fin} onChange={(e) => set("fin", e.target.value)} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <p className="mb-3 text-sm font-medium text-ink/85">Quels moments dois-je animer ?</p>
                  <div className="flex flex-wrap gap-2">
                    {questionnaire.moments.map((m) => (
                      <Chip key={m} label={m} checked={data.moments.includes(m)} onChange={(v) => toggle("moments", m, v)} />
                    ))}
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {questionnaire.chansonsCles.map((c, i) => (
                    <Input
                      key={c}
                      id={`q-chanson-${i}`}
                      label={`Chanson : ${c}`}
                      placeholder="Titre — artiste"
                      value={data.chansons[c] ?? ""}
                      onChange={(e) => set("chansons", { ...data.chansons, [c]: e.target.value })}
                    />
                  ))}
                </div>
                <Textarea id="q-anim" label="Jeux, vidéos, discours prévus (qui, quand ?)" value={data.animations} onChange={(e) => set("animations", e.target.value)} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                <div>
                  <p className="mb-4 text-sm text-ink-muted">Pour chaque style, dites-moi à quel point vous l&apos;aimez (laissez vide si ça vous est égal).</p>
                  <ul className="divide-y divide-line">
                    {musique.styles.map((s, si) => (
                      <li key={s} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <span id={`g-${si}`} className="font-medium">{s}</span>
                        <div role="radiogroup" aria-labelledby={`g-${si}`} className="flex flex-wrap gap-1.5">
                          {questionnaire.niveauxGout.map((n, ni) => {
                            const on = data.gouts[s] === ni;
                            return (
                              <button
                                key={n}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => {
                                  const g = { ...data.gouts };
                                  if (on) delete g[s];
                                  else g[s] = ni;
                                  set("gouts", g);
                                }}
                                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                                  on
                                    ? ni === 0
                                      ? "border-ink-faint bg-white/10 text-ink"
                                      : ni === 3
                                        ? "border-magenta bg-magenta/20 text-magenta-soft shadow-glow-magenta"
                                        : "border-gold bg-gold/15 text-gold-soft"
                                    : "border-line text-ink-faint hover:text-ink"
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Textarea id="q-must" label="Les incontournables" placeholder="Les chansons à passer absolument" value={data.incontournables} onChange={(e) => set("incontournables", e.target.value)} />
                  <Textarea id="q-no" label="À ne surtout pas passer" placeholder="Chansons ou styles à éviter" value={data.interdites} onChange={(e) => set("interdites", e.target.value)} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8">
                <div>
                  <p className="mb-3 text-sm font-medium text-ink/85">Effets et options qui vous intéressent</p>
                  <div className="flex flex-wrap gap-2">
                    {effets.liste.map((o) => (
                      <Chip key={o.id} label={o.titre} checked={data.options.includes(o.titre)} onChange={(v) => toggle("options", o.titre, v)} />
                    ))}
                  </div>
                </div>
                <Textarea id="q-rem" label="Autres remarques, surprises, contraintes de la salle…" rows={5} value={data.remarques} onChange={(e) => set("remarques", e.target.value)} />
              </div>
            )}

            {step === 5 && (
              <div>
                <dl className="divide-y divide-line rounded-lg border border-line">
                  {Object.entries(summary).map(([k, v]) => (
                    <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[13rem_1fr]">
                      <dt className="text-sm text-ink-faint">{k}</dt>
                      <dd className={`text-sm ${v ? "text-ink" : "text-ink-faint italic"}`}>{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <MagneticButton onClick={send} disabled={status === "sending" || !data.email}>
                    {status === "sending" ? "Envoi…" : "Envoyer à Millenium DJ"}
                  </MagneticButton>
                  <MagneticButton variant="ghost" onClick={download}>Télécharger le récapitulatif</MagneticButton>
                </div>
                {!data.email && <p className="mt-3 text-sm text-magenta-soft">Indiquez votre e-mail à l&apos;étape « Vous » pour envoyer.</p>}
                <div aria-live="polite" className="mt-4 text-sm">
                  {status === "sent" && <p className="text-gold">{formulaires.messageSucces}</p>}
                  {status === "mailto" && (
                    <p className="text-ink-muted">
                      Votre messagerie s&apos;ouvre avec vos réponses. Si le message est tronqué, joignez le récapitulatif téléchargé et envoyez-le à{" "}
                      <a className="text-gold underline" href={`mailto:${entreprise.email}`}>{entreprise.email}</a>.
                    </p>
                  )}
                  {status === "error" && <p className="text-magenta-soft">{formulaires.messageErreur}</p>}
                </div>
              </div>
            )}
          </motion.fieldset>
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => go(step - 1)}
            className={`text-sm text-ink-muted hover:text-gold ${step === 0 ? "invisible" : ""}`}
          >
            ← Précédent
          </button>
          {step < STEPS.length - 1 ? (
            <MagneticButton type="submit">Suivant →</MagneticButton>
          ) : (
            <button type="button" onClick={reset} className="text-sm text-ink-faint hover:text-magenta-soft">Tout effacer</button>
          )}
        </div>
      </form>
      <p className="mt-4 text-center text-xs text-ink-faint">Réponses enregistrées automatiquement sur cet appareil.</p>
    </div>
  );
}
