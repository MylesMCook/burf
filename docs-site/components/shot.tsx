import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import type { ReactNode } from 'react';
import sizes from '@/lib/shots.json';

// A screenshot of the app, light and dark: public/shots/<name>-light.webp and
// <name>-dark.webp, taken by scripts/docs-shots/capture.mjs, which also writes
// each one's size in CSS pixels to lib/shots.json. The page keeps that room
// before the picture loads, shows the one for the docs' theme (only that one
// is fetched: the other is display: none, and both are lazy), and a click
// opens it full size.
//
//   <Shot name="themes" alt="Settings → Appearance: the theme cards" />
//   <Shot name="tab-groups" alt="…" caption="What it shows, in a sentence." />
//
// A shot is never wider than it was taken, so text in it stays at most its
// real size; a wide one shrinks to the column, and opens full size.

export type ShotName = keyof typeof sizes;

export function Shot({ name, alt, caption }: { name: ShotName; alt: string; caption?: ReactNode }) {
  const size = sizes[name];
  if (!size) throw new Error(`No shot named "${name}": run scripts/docs-shots/capture.mjs --only ${name}`);
  const img = (theme: 'light' | 'dark') => {
    const src = `/shots/${name}-${theme}.webp`;
    return (
      <span className={`berth-shot-${theme}`}>
        <ImageZoom src={src} alt={alt} zoomInProps={{ alt }}>
          <img src={src} alt={alt} width={size.width} height={size.height} loading="lazy" decoding="async" />
        </ImageZoom>
      </span>
    );
  };
  return (
    <figure className="berth-shot not-prose" style={{ maxWidth: size.width }}>
      {img('light')}
      {img('dark')}
      {caption && <figcaption className="berth-shot-caption">{caption}</figcaption>}
    </figure>
  );
}
