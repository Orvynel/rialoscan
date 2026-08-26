export function Mark({ size = 15 }: { size?: number }) {
  // Three stacked strata narrowing to a point: layers of history with the oldest
  // at the base, which is what an explorer reads. Deliberately name-neutral.
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

export function SunIcon({ size = 14 }: { size?: number }) {
  // Eight rays rather than a filled disc, so it sits at the same visual weight
  // as the other outline icons in the header.
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="2.7" stroke="currentColor" strokeWidth="1.15" />
      <g stroke="currentColor" strokeWidth="1.15" strokeLinecap="round">
        <path d="M7 0.9v1.5M7 11.6v1.5M0.9 7h1.5M11.6 7h1.5" />
        <path d="M2.7 2.7l1.1 1.1M10.2 10.2l1.1 1.1M11.3 2.7l-1.1 1.1M3.8 10.2l-1.1 1.1" />
      </g>
    </svg>
  );
}

export function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M11.4 8.9A5.1 5.1 0 0 1 5.1 2.6a5.1 5.1 0 1 0 6.3 6.3Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
    </svg>
  );
}
