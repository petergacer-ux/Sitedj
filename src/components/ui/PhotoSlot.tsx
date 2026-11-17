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
      <div className="relative m-4 flex items-center gap-2 text-xs text-ink-faint">
        <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        Photo à venir{photo.label ? ` · ${photo.label}` : ""}
      </div>
    </div>
  );
}
