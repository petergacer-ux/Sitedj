import { entreprise, formulaires } from "@/content/site";

export type SubmitResult = "sent" | "mailto" | "error";

/** Transforme un objet { libellé: valeur } en texte lisible. */
export function toPlainText(data: Record<string, string>) {
  return Object.entries(data)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k} : ${v}`)
    .join("\n");
}

/**
 * Envoie un formulaire :
 * - via le service configuré dans formulaires.endpoint (Formspree, etc.)
 * - sinon, ouvre la messagerie du visiteur avec un e-mail pré-rempli.
 */
export async function submitForm(subject: string, data: Record<string, string>, replyTo?: string): Promise<SubmitResult> {
  if (formulaires.endpoint) {
    try {
      const res = await fetch(formulaires.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ _subject: subject, ...(replyTo ? { _replyto: replyTo, email: replyTo } : {}), ...data }),
      });
      return res.ok ? "sent" : "error";
    } catch {
      return "error";
    }
  }
  const body = toPlainText(data);
  // Les clients mail limitent la longueur des liens mailto
  const max = 1800;
  const safe = body.length > max ? body.slice(0, max) + "\n[…]" : body;
  window.location.href = `mailto:${entreprise.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(safe)}`;
  return "mailto";
}
