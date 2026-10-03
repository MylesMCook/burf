// The mark: a B drawn in one line, with the amber dot (the one lamp), and the
// lowercase wordmark. The same drawing as the landing page's header and
// site/assets/favicon.svg.
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="80 20 384 472" aria-hidden="true" className={className}>
      <path
        d="M116 84 H300 a96 96 0 0 1 0 192 H116 Z M116 276 H324 a104 104 0 0 1 0 208 H116 Z"
        transform="translate(0,-28)"
        fill="none"
        stroke="currentColor"
        strokeWidth="68"
        strokeLinejoin="round"
      />
      <circle cx="296" cy="152" r="30" fill="var(--berth-amber)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="berth-brand">
      <Mark className="berth-brand-mark" />
      <span className="berth-brand-word">berth</span>
      <span className="berth-brand-docs">docs</span>
    </span>
  );
}
