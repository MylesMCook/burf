import * as stylex from "@stylexjs/stylex";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const paint = stylex.create({
  s0: {
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "currentColor",
    "opacity": 0.7,
  },
  q1: {
    ":is([data-pressed] &)": {
      "backgroundColor": "currentColor",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// BoxFilter chooses which boxes a page covers. Pressed means shown: every
// box starts pressed, turning one off hides what is on it, and the last
// one on stays on, so the filter never empties the page by itself. The
// Agent Dashboard, Worktrees, History, Automations runs and Usage share it.
//
// `hidden` is what is kept, so a new box shows up on its own. Boxes in
// `hidden` that are not in `boxes` (offline, say) stay hidden.
//
// Narrowing by what rows have (a label, a state) is FilterChip's job, and
// picking one of a few values is PickOne's.
export function BoxFilter({
  boxes,
  hidden,
  onChange,
  label = "Boxes to show",
  align,
}: {
  boxes: string[];
  hidden: string[];
  onChange(hidden: string[]): void;
  label?: string;
  align?: "end";
}) {
  if (boxes.length < 2) return null;
  const shown = boxes.filter((b) => !hidden.includes(b));
  return (
    <ToggleGroup
      align={align}
      multiple
      shrink
      size="sm"
      variant="outline"
      // A stored filter can hide every box there is now; show them all then.
      value={shown.length ? shown : boxes}
      onValueChange={(v) => {
        const on = v as string[];
        if (!on.length) return;
        onChange([...hidden.filter((h) => !boxes.includes(h)), ...boxes.filter((b) => !on.includes(b))]);
      }}
      aria-label={label}
    >
      {boxes.map((b) => (
        <ToggleGroupItem
          key={b}
          value={b}
          tone="choice"
        >
          {/* Filled when shown, hollow when hidden: the state reads without colour. */}
          <span className={[sx(paint.s0), sx(paint.q1)].filter(Boolean).join(" ")} aria-hidden />
          {b}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

// shownBoxes is what a BoxFilter leaves on, all of them if it hides every one.
export function shownBoxes(boxes: string[], hidden: string[]): string[] {
  const shown = boxes.filter((b) => !hidden.includes(b));
  return shown.length ? shown : boxes;
}
