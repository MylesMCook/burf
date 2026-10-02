import type { ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface PickOneOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

// PickOne is the app's one control for picking one of a few values: a coss
// ToggleGroup, 28px high, in a muted track, the chosen item raised and the
// rest at 80% foreground. Settings, New worktree, Hand off and Review use it.
//
// Base UI's ToggleGroup never presses an item whose value is the empty
// string, so "" (such as "No agent") travels through the group as NONE.
const NONE = "__none__";
const toItem = (v: string) => (v === "" ? NONE : v);
const fromItem = (v: string) => (v === NONE ? "" : v);

export function PickOne<T extends string>({ value, options, onChange, label, className }: { value: T; options: PickOneOption<T>[]; onChange(v: T): void; label?: string; className?: string }) {
  return (
    <ToggleGroup
      aria-label={label}
      size="sm"
      value={[toItem(value)]}
      // Clicking the chosen item again keeps it chosen.
      onValueChange={(v) => v.length && onChange(fromItem(v[v.length - 1] as string) as T)}
      className={cn("w-fit max-w-full flex-wrap rounded-lg bg-muted p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={toItem(o.value)}
          value={toItem(o.value)}
          className="gap-1.5 rounded-md px-2.5 font-normal text-[13px] text-foreground/80 hover:bg-background/60 hover:text-foreground data-pressed:bg-background data-pressed:font-medium data-pressed:text-foreground data-pressed:shadow-xs/5 dark:hover:bg-input/32 dark:data-pressed:bg-input"
        >
          {o.icon}
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
