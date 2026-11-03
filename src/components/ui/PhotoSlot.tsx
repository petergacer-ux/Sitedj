import type { Photo } from "@/content/types";

/** Photo réelle si `src` est rempli, sinon emplacement animé « Photo à venir ». */
export function PhotoSlot({ photo, className = "", sizes }: { photo: Photo; className?: string; sizes?: string }) {
  if (photo.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        sizes={sizes}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${photo.alt} (photo à venir)`}
      className={`photo-slot relative flex h-full w-full items-end overflow-hidden ${className}`}
    >
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(var(--rgb-gold)/.25),transparent_55%)]" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgb(var(--rgb-magenta)/.3),transparent_50%)]" />
      <div className="relative m-4 flex items-center gap-2 rounded-full border border-white/15 bg-night-950/50 px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-ink/80 backdrop-blur">
        <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        Photo à venir{photo.label ? ` · ${photo.label}` : ""}
      </div>
    </div>
  );
}
