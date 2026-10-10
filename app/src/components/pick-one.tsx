import type { ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface PickOneOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  // For the rare option that needs a tone of its own when chosen.
  tone?: "warning";
}

// PickOne is the app's one control for picking one of a few values: a coss
// ToggleGroup, 28px high, in a muted track, the chosen item raised and the
// rest at 80% foreground. Settings, New worktree, Hand off, Review, the diff
// layout, a flow step's "Runs" and the plugins' screens use it; a page's
// filter with an "All" choice (Activity's kinds, Issues' assignee) is one
// too. Which boxes a page covers is BoxFilter; narrowing by labels or tags,
// any number at once, is FilterChip.
//
// Base UI's ToggleGroup never presses an item whose value is the empty
// string, so "" (such as "No agent") travels through the group as NONE.
const NONE = "__none__";
const toItem = (v: string) => (v === "" ? NONE : v);
const fromItem = (v: string) => (v === NONE ? "" : v);

export function PickOne<T extends string>({
  value,
  options,
  onChange,
  label,
  align,
  nudge = false,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: {
  value: T;
  options: PickOneOption<T>[];
  onChange(v: T): void;
  label?: string;
  align?: "end";
  nudge?: boolean;
  // A visible label elsewhere (a settings row's) names the group instead.
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  return (
    <ToggleGroup
      align={align}
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={label ? undefined : labelledBy}
      nudge={nudge}
      onValueChange={(v) => v.length && onChange(fromItem(v[v.length - 1] as string) as T)}
      shrink
      size="sm"
      track
      value={[toItem(value)]}
      wrap
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={toItem(o.value)}
          value={toItem(o.value)}
          tone={o.tone ?? "choice"}
        >
          {o.icon}
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
