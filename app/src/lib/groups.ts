// Worktrees side by side (Labs): the pure part. Each worktree on screen
// wears one colour wherever it shows (its group in the strip, its panes'
// chips and focus lines, its sidebar row), and a name that tells it apart
// from the others there. No imports: pnpm test runs this file as it is.

// The tones, kept clear of the colours that mean an agent's state: amber
// waits, blue runs, green is done, red failed. index.css defines each as
// --wt-<tone>, for light and dark. Listed so that neighbours differ most.
export const TONES = ["violet", "lime", "magenta", "cyan", "pink", "slate"] as const;
export type Tone = (typeof TONES)[number];

// Tones close enough in hue to be confused side by side.
const NEAR: Partial<Record<Tone, Tone[]>> = { violet: ["magenta"], magenta: ["violet", "pink"], pink: ["magenta"] };

export const isTone = (t: unknown): t is Tone => typeof t === "string" && (TONES as readonly string[]).includes(t);

export const toneVar = (t: Tone) => `var(--wt-${t})`;

// hashTone is a worktree's own tone, the same every time.
export function hashTone(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % TONES.length;
}

// assignTones gives each of keys (in the strip's order) a tone: the one the
// person picked, else its hash's, moved along when an earlier worktree has
// it or one close to it, so worktrees on screen never look alike while
// there are tones enough.
export function assignTones(keys: string[], picked: Record<string, string> = {}): Record<string, Tone> {
  const out: Record<string, Tone> = {};
  const taken = new Set<Tone>();
  for (const k of keys) {
    const p = picked[k];
    if (isTone(p)) {
      out[k] = p;
      taken.add(p);
    }
  }
  const clash = (t: Tone) => taken.has(t) || (NEAR[t] ?? []).some((n) => taken.has(n));
  for (const k of keys) {
    if (out[k]) continue;
    const from = hashTone(k);
    const walk = TONES.map((_, n) => TONES[(from + n) % TONES.length]);
    const t = walk.find((x) => !clash(x)) ?? walk.find((x) => !taken.has(x)) ?? walk[0];
    out[k] = t;
    taken.add(t);
  }
  return out;
}

export interface Named {
  key: string;
  name: string;
  box: string;
}

// labelsFor names worktrees as the sidebar does, adding the box when two
// on screen share a name (the same repository on two boxes).
export function labelsFor(list: Named[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of list) out[w.key] = list.some((o) => o.key !== w.key && o.name === w.name) ? `${w.name} · ${w.box}` : w.name;
  return out;
}

// nameFromKey is a worktree's name when nothing lists it any more: the last
// part of its path.
export const nameFromKey = (key: string) => key.slice(key.indexOf(":") + 1).split("/").filter(Boolean).pop() ?? key;
