import { CircleAlert, CircleCheck, CircleX, Info } from 'lucide-react';
import type { ReactNode } from 'react';

// Callouts in the brand: one outline all round, never a coloured stripe down
// one side (app/src/components/ui/card.tsx). A warning tints the whole
// outline amber, the colour that means "this needs you"; everything else
// stays neutral and says what it is with a glyph.
type CalloutType = 'info' | 'warn' | 'warning' | 'error' | 'success' | 'idea' | 'tip';

const icons = {
  info: Info,
  warning: CircleAlert,
  error: CircleX,
  success: CircleCheck,
} as const;

export function Callout({ type = 'info', title, children }: { type?: CalloutType; title?: ReactNode; children?: ReactNode }) {
  const kind = type === 'warn' || type === 'warning' ? 'warning' : type === 'error' || type === 'success' ? type : 'info';
  const Icon = icons[kind];
  return (
    <div className="berth-callout not-prose" data-type={kind} role={kind === 'warning' || kind === 'error' ? 'note' : undefined}>
      <Icon className="berth-callout-icon" aria-hidden="true" />
      <div className="berth-callout-body">
        {title && <p className="berth-callout-title">{title}</p>}
        <div className="berth-callout-text">{children}</div>
      </div>
    </div>
  );
}
