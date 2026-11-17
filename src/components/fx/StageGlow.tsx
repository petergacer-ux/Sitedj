/** Fond lumineux discret (pages secondaires). */
export function StageGlow() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10">
      <div className="absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(var(--rgb-gold)/.08),transparent_70%)]" />
    </div>
  );
}
