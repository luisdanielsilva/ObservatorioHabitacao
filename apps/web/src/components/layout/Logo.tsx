/**
 * Observatório Habitação mark ("Ocular"): a house seen through a telescope's eyepiece, with the
 * sight marks in sand. The same drawing is the favicon (app/icon.svg), the share image and the
 * PDF header.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className ?? ""}`}>
      <LogoMark className="size-7" />
      <span className="text-lg">
        Observatório <span className="text-primary">Habitação</span>
      </span>
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="none"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="16" cy="16" r="11" className="stroke-primary" />
      <path
        d="M16 2.5v3.5M16 26v3.5M2.5 16H6M26 16h3.5"
        className="stroke-brand-accent"
        strokeWidth="2.6"
      />
      <path d="M10.5 18 16 13l5.5 5M12 17v5.5h8V17" className="stroke-primary" />
    </svg>
  );
}
