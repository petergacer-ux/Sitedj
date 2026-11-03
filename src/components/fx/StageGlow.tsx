/** Fond lumineux statique (pages secondaires). */
export function StageGlow() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_-10%,var(--c-night700),transparent_70%)]" />
      <div className="absolute -top-40 left-[10%] h-[140%] w-48 rotate-[20deg] bg-gradient-to-b from-gold/25 to-transparent blur-3xl" />
      <div className="absolute -top-40 right-[15%] h-[140%] w-56 -rotate-[24deg] bg-gradient-to-b from-magenta/25 to-transparent blur-3xl" />
    </div>
  );
}
