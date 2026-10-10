import * as stylex from "@stylexjs/stylex";
import { ArrowRightLeftIcon, BookMarkedIcon, EllipsisIcon, GitCompareArrowsIcon, RepeatIcon, ScanEyeIcon, SendIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Tip } from "@/components/tip";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { openAttempts } from "@/lib/composer";
import { openPromptPicker } from "@/lib/prompts";
import { type OrchestrateDraft, useStore } from "@/lib/store";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s1: {
    "width": "14px",
    "height": "14px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const actions: { kind: OrchestrateDraft["kind"]; label: string; Icon: typeof SendIcon }[] = [
  { kind: "send", label: "Send prompt…", Icon: SendIcon },
  { kind: "handoff", label: "Hand off to…", Icon: ArrowRightLeftIcon },
  { kind: "review", label: "Review with…", Icon: ScanEyeIcon },
  { kind: "loop", label: "Loop until…", Icon: RepeatIcon },
];

// The actions that type into the session itself.
const TYPES_INTO = new Set<OrchestrateDraft["kind"]>(["send", "loop"]);

export const openOrchestrate = (kind: OrchestrateDraft["kind"], box: string, session: string) => useStore.getState().setOrchestrate({ kind, box, session });

// SessionActionItems are the orchestration actions for one session, to put
// inside a menu that already exists (a pane header's).
//
// An agent that has ended takes no input, so nothing here offers to send it
// anything: what remains is handing its work on or having it reviewed.
export function SessionActionItems({ box, session }: { box: string; session: string }) {
  const ended = useStore((s) => {
    const list = s.boxes[box]?.sessions;
    if (!list) return false;
    const x = list.find((y) => y.name === session);
    return !x || x.exited;
  });
  const shown = ended ? actions.filter((a) => !TYPES_INTO.has(a.kind)) : actions;
  return (
    <MenuGroup>
      <MenuGroupLabel>{ended ? "Orchestrate · ended" : "Orchestrate"}</MenuGroupLabel>
      {shown.map(({ kind, label, Icon }) => (
        <MenuItem key={kind} onClick={() => openOrchestrate(kind, box, session)}>
          <Icon />
          {label}
        </MenuItem>
      ))}
      {!ended && (
        <MenuItem onClick={() => openPromptPicker({ box, session })}>
          <BookMarkedIcon />
          Send a saved prompt…
        </MenuItem>
      )}
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
              className={[sx(paint.s0), className].filter(Boolean).join(" ")}
              // Inside a clickable card, opening the menu must not open the card.
              onClick={(e) => e.stopPropagation()}
            />
          }
        >
          <EllipsisIcon className={sx(paint.s1)} />
        </MenuTrigger>
      </Tip>
      <MenuPopup align="end" width={menuWidths.w48}>
        <SessionActionItems box={box} session={session} />
        {children}
      </MenuPopup>
    </Menu>
  );
}
