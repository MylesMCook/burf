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
export function PickOne<T extends string>({ value, options, onChange, label, className }: { value: T; options: PickOneOption<T>[]; onChange(v: T): void; label?: string; className?: string }) {
  return (
    <ToggleGroup
      aria-label={label}
      size="sm"
      value={[value]}
      // Clicking the chosen item again keeps it chosen.
      onValueChange={(v) => v.length && onChange(v[v.length - 1] as T)}
      className={cn("w-fit max-w-full flex-wrap rounded-lg bg-muted p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value || "none"}
          value={o.value}
          className="gap-1.5 rounded-md px-2.5 font-normal text-[13px] text-foreground/80 hover:bg-background/60 hover:text-foreground data-pressed:bg-background data-pressed:font-medium data-pressed:text-foreground data-pressed:shadow-xs/5 dark:hover:bg-input/32 dark:data-pressed:bg-input"
        >
          {o.icon}
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
