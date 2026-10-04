import { ArrowRightLeftIcon, BookMarkedIcon, EllipsisIcon, GitCompareArrowsIcon, RepeatIcon, ScanEyeIcon, SendIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Tip } from "@/components/tip";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { openAttempts } from "@/components/orchestrate/attempts-dialog";
import { openPromptPicker } from "@/lib/prompts";
import { type OrchestrateDraft, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const actions: { kind: OrchestrateDraft["kind"]; label: string; Icon: typeof SendIcon }[] = [
  { kind: "send", label: "Send prompt…", Icon: SendIcon },
  { kind: "handoff", label: "Hand off to…", Icon: ArrowRightLeftIcon },
  { kind: "review", label: "Review with…", Icon: ScanEyeIcon },
  { kind: "loop", label: "Loop until…", Icon: RepeatIcon },
];

export const openOrchestrate = (kind: OrchestrateDraft["kind"], box: string, session: string) => useStore.getState().setOrchestrate({ kind, box, session });

// SessionActionItems are the orchestration actions for one session, to put
// inside a menu that already exists (a pane header's).
export function SessionActionItems({ box, session }: { box: string; session: string }) {
  return (
    <MenuGroup>
      <MenuGroupLabel>Orchestrate</MenuGroupLabel>
      {actions.map(({ kind, label, Icon }) => (
        <MenuItem key={kind} onClick={() => openOrchestrate(kind, box, session)}>
          <Icon />
          {label}
        </MenuItem>
      ))}
      <MenuItem onClick={() => openPromptPicker({ box, session })}>
        <BookMarkedIcon />
        Send a saved prompt…
      </MenuItem>
      <MenuItem
        onClick={() => {
          const s = useStore.getState().boxes[box]?.sessions?.find((x) => x.name === session);
          const [location] = (s?.location ?? "").split("/");
          if (location) openAttempts({ box, location });
        }}
      >
        <GitCompareArrowsIcon />
        Try N ways…
      </MenuItem>
    </MenuGroup>
  );
}

// SessionActions is a compact menu of them, for cards and rows; children go
// after them (a card's "Stop agent…").
export function SessionActions({ box, session, className, children }: { box: string; session: string; className?: string; children?: ReactNode }) {
  return (
    <Menu>
      <Tip label="Orchestrate">
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label={`Orchestrate ${session}`}
              className={cn("inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground", className)}
              // Inside a clickable card, opening the menu must not open the card.
              onClick={(e) => e.stopPropagation()}
            />
          }
        >
          <EllipsisIcon className="size-3.5" />
        </MenuTrigger>
      </Tip>
      <MenuPopup align="end" className="min-w-48">
        <SessionActionItems box={box} session={session} />
        {children}
      </MenuPopup>
    </Menu>
  );
}
