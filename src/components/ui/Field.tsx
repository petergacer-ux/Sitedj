import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-md border border-line bg-night-950/60 px-4 py-3.5 text-base text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-200 hover:border-white/20 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25";

export function Label({ children, htmlFor, required }: { children: ReactNode; htmlFor: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink/85">
      {children}
      {required && <span className="ml-1 text-magenta-soft" aria-hidden>*</span>}
    </label>
  );
}

export function Input({ label, id, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className={className}>
      <Label htmlFor={id} required={props.required}>{label}</Label>
      <input id={id} name={props.name ?? id} className={control} {...props} />
    </div>
  );
}

export function Select({ label, id, options, className = "", placeholder = "Choisir…", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string; options: string[]; placeholder?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={id} required={props.required}>{label}</Label>
      <div className="relative">
        <select id={id} name={props.name ?? id} className={`${control} appearance-none pr-10`} {...props}>
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-gold" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </div>
    </div>
  );
}

export function Textarea({ label, id, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string }) {
  return (
    <div className={className}>
      <Label htmlFor={id} required={props.required}>{label}</Label>
      <textarea id={id} name={props.name ?? id} rows={props.rows ?? 4} className={`${control} resize-y`} {...props} />
    </div>
  );
}

/** Puce cochable (checkbox stylée). */
export function Chip({ label, checked, onChange, name }: { label: string; checked: boolean; onChange: (v: boolean) => void; name?: string }) {
  return (
    <label className={`inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${checked ? "border-gold bg-gold/15 text-gold-soft shadow-[0_0_20px_rgb(var(--rgb-gold)/.2)]" : "border-line text-ink-muted hover:border-white/25 hover:text-ink"}`}>
      <input type="checkbox" name={name} className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className={`grid size-4 place-items-center rounded-full border transition-colors ${checked ? "border-gold bg-gold text-night-950" : "border-ink-faint"}`}>
        {checked && <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5 9-10" /></svg>}
      </span>
      {label}
    </label>
  );
}
