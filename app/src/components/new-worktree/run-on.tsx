import { PinIcon } from "lucide-react";

import { Picker, PickerAction, type PickerItem } from "@/components/new-worktree/picker";
import type { Location } from "@/lib/api";
import type { InstalledKitOn } from "@/lib/kits";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface RunOnOption {
  box: string;
  location: Location;
  online: boolean;
}

// RunOn picks which box a project's new worktree goes to, when the project
// is checked out on more than one: each box with its path, how loaded it
// is, and whether its kit is there and current.
export function RunOn({
  options,
  value,
  onChange,
  defaultBox,
  onSetDefault,
  kits,
}: {
  options: RunOnOption[];
  value: string;
  onChange(box: string): void;
  defaultBox?: string;
  onSetDefault(box: string): void;
  kits: InstalledKitOn[];
}) {
  const boxes = useStore((s) => s.boxes);
  const items: PickerItem[] = options.map(({ box, location, online }) => {
    const stats = boxes[box]?.stats;
    const memory = stats?.memory.total ? Math.round((stats.memory.used / stats.memory.total) * 100) : undefined;
    const working = stats?.agents.filter((a) => a.state === "running").length ?? 0;
    const kit = kits.find((k) => k.box === box && k.location === location.name);
    return {
      value: box,
      label: box,
      detail: location.path,
      disabled: !online,
      keywords: location.name,
      trailing: online ? (
        <span className="flex items-center gap-1.5">
          {kit && <span className={cn("rounded border px-1 text-[11px]", kit.outdated ? "border-warning/40 text-warning" : "text-muted-foreground")}>{kit.outdated ? "kit outdated" : `${kit.kit.name} kit`}</span>}
          {/* Said in words: a tooltip on a row people sweep through is noise. */}
          {memory !== undefined && <span className={cn("whitespace-nowrap tabular-nums", memory >= 85 && "text-warning")}>{memory}% memory</span>}
          {working > 0 && <span className="whitespace-nowrap">· {working} working</span>}
          {box === defaultBox && <span className="text-foreground/80">default</span>}
        </span>
      ) : (
        <span>offline</span>
      ),
    };
  });
  return (
    <Picker
      variant="inline"
      aria-label="Run on"
      items={items}
      value={value}
      onChange={onChange}
      searchPlaceholder="Search boxes…"
      footer={
        value && value !== defaultBox
          ? (close) => (
              <PickerAction
                icon={<PinIcon className="size-4" />}
                onClick={() => {
                  close();
                  onSetDefault(value);
                }}
              >
                Set {value} as the default box
              </PickerAction>
            )
          : undefined
      }
    />
  );
}
