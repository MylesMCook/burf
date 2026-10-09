// Use the full-color app icon on both light and dark headers.
export function Mark({ className }: { className?: string }) {
  return (
    <img src="/branding/burf-app-icon.svg" width="28" height="28" alt="" aria-hidden="true" className={className} />
  );
}

export function Logo() {
  return (
    <span className="berth-brand">
      <Mark className="berth-brand-mark" />
      <span className="berth-brand-word">Burf</span>
      <span className="berth-brand-docs">docs</span>
    </span>
  );
}
