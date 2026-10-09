import { CornerDownLeftIcon, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { Tip } from "@/components/tip";
import { cn } from "@/lib/utils";

const Dot = () => (
  <span className="shrink-0 text-muted-foreground/60" aria-hidden>
    ·
  </span>
);

// BerthAvatar is Burf's own mark, for its reports.
export function BerthAvatar() {
  return (
    <span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-[#F4EAD5]">
      <img src={`${import.meta.env.BASE_URL}branding/burf-mark.svg`} alt="" width="16" height="16" className="size-4" />
    </span>
  );
}

export type ChipTone = "plain" | "ask" | "bad" | "lead" | "good";
export interface Chip {
  word: string;
  Icon: LucideIcon;
  tone: ChipTone;
}

export function KindChip({ chip, className }: { chip: Chip; className?: string }) {
  return (
    <span
      data-chip={chip.word}
      className={cn(
        "inline-flex h-[1.125rem] shrink-0 items-center gap-1 rounded-[0.3125rem] border px-1.5 font-medium text-[0.6875rem] leading-none",
        chip.tone === "plain" && "border-border bg-muted/60 text-muted-foreground",
        chip.tone === "good" && "border-success/30 bg-success/8 text-success-foreground",
        chip.tone === "ask" && "border-warning/35 bg-warning/10 text-warning-foreground",
        chip.tone === "bad" && "border-destructive/30 bg-destructive/8 text-destructive-foreground",
        chip.tone === "lead" && "am-c-orange am-chip-tint",
        className,
      )}
    >
      <chip.Icon className="size-3" aria-hidden />
      {chip.word}
    </span>
  );
}

// CardHead is the head every card to the agent shares, Burf's reports
// included: avatar, name, what kind of sender, a kind chip, what else it
// says (a diff, a count), the time it took, "to Claude" and Open.
export function CardHead({ avatar, name, kind, chip, extra, took, tip, open }: { avatar: ReactNode; name: string; kind?: string; chip: Chip; extra?: ReactNode; took?: string; tip: string; open?: ReactNode }) {
  return (
    <div className="flex min-h-8 min-w-0 items-center gap-1.5 py-1 pr-1 pl-2">
      {avatar}
      <span className="ml-0.5 min-w-0 shrink truncate font-medium" data-card-name>
        {name}
      </span>
      {kind && <span className="hidden shrink-0 text-muted-foreground text-xs @[420px]:inline">{kind}</span>}
      <KindChip chip={chip} className="ml-1" />
      {extra}
      {took && (
        <span className="hidden shrink-0 items-center gap-1.5 text-muted-foreground text-xs tabular-nums @[520px]:inline-flex">
          <Dot />
          {took}
        </span>
      )}
      <Tip label={tip}>
        <span data-to-agent className="ml-auto inline-flex shrink-0 items-center gap-1 pl-2 text-[0.75rem] text-muted-foreground">
          <CornerDownLeftIcon className="size-3" aria-hidden />
          <span className="hidden @[360px]:inline">to Claude</span>
        </span>
      </Tip>
      {open}
    </div>
  );
}
