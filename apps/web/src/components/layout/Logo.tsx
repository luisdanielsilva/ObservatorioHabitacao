/** OlhoVivo mark: an eye whose iris is a rising bar chart. Placeholder until the brand work. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className ?? ""}`}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 text-primary">
        <path
          d="M2 16c3.5-6.5 8.5-10 14-10s10.5 3.5 14 10c-3.5 6.5-8.5 10-14 10S5.5 22.5 2 16Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="16" r="6.5" fill="currentColor" opacity="0.18" />
        <path
          d="M12.5 19.5v-2.5M16 19.5v-5M19.5 19.5v-7.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg">
        Olho<span className="text-primary">Vivo</span>
      </span>
    </span>
  );
}
