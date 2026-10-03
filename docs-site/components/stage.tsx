import type { ReactNode } from 'react';
import { Scene, type SceneName } from './art/scenes';

// The landing page's stage: a quiet panel with one harbour drawing in it,
// beside whatever the reader should do first. Used once, on the home page.
export function Stage({ scene = 'moored', title, children }: { scene?: SceneName; title?: ReactNode; children: ReactNode }) {
  return (
    <section className="berth-stage not-prose">
      <div className="berth-stage-body">
        {title && <p className="berth-stage-title">{title}</p>}
        <div className="berth-stage-text prose">{children}</div>
      </div>
      <div className="berth-stage-art" aria-hidden="true">
        <Scene name={scene} width={232} />
      </div>
    </section>
  );
}
