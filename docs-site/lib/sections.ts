import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A page's section, as its folder's meta.json names it ("Getting started"),
// for the small label above the title.
const cache = new Map<string, string | undefined>();

export function sectionTitle(slugs: string[]): string | undefined {
  if (slugs.length < 2) return undefined;
  const folder = slugs[0];
  if (!cache.has(folder)) {
    let title: string | undefined;
    try {
      const meta = JSON.parse(readFileSync(join(process.cwd(), '..', 'docs', folder, 'meta.json'), 'utf8'));
      title = typeof meta.title === 'string' ? meta.title : undefined;
    } catch {
      title = undefined;
    }
    cache.set(folder, title);
  }
  return cache.get(folder);
}
