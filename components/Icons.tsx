export function GlacierMark({ size = 15 }: { size?: number }) {
  // Three stacked strata under a peak: a glacier in cross-section, which is
  // also what a block explorer shows — layers of history, oldest at the base.
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.4 1.2 13.4h13.6L8 1.4Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M4.6 9.2h6.8" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.55" />
      <path d="M6.2 6.4h3.6" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.3" />
    </svg>
  );
}

export function SearchIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.3 9.3 12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="4.6" y="4.6" width="8" height="8" rx="1.3" stroke="currentColor" strokeWidth="1.15" />
      <path d="M9.4 1.4H2.7a1.3 1.3 0 0 0-1.3 1.3v6.7" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.4 7.4 5.4 10.4 11.6 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
