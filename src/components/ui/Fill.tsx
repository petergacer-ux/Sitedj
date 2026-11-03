import { Fragment } from "react";

const MARK = /(\[À COMPLÉTER[^\]]*\])/g;

/** Affiche un texte du contenu en mettant en évidence les « [À COMPLÉTER] ». */
export function Fill({ text }: { text: string }) {
  const parts = text.split(MARK);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        MARK.test(p) ? (
          <em key={i} className="a-completer" title="Information à compléter dans src/content/site.ts">
            {p}
          </em>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export const isMissing = (s: string) => s.includes("[À COMPLÉTER");
