import * as stylex from "@stylexjs/stylex";
import { HouseIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusDot, useBoxState } from "@/components/agent-glyph";
import { boxLoad } from "@/components/sidebar/box-load";
import { toastManager } from "@/components/ui/toast";
import { Command, CommandCollection, CommandDialog, CommandDialogPopup, CommandEmpty, CommandFooter, CommandGroup, CommandGroupLabel, CommandInput, CommandItem, CommandList, CommandPanel } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { startSession } from "@/lib/actions";
import { closeBoxPicker, lastHomeBox, openBoxPicker, pickableBoxes, rememberHomeBox, useBoxPicker } from "@/lib/box-home";
import { useStore } from "@/lib/store";
import { here, homeKey } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s1: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--accent)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s2: {
    "marginLeft": "auto",
    "minWidth": "0px",
    "flexShrink": 1,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s3: {
    "color": "var(--muted-foreground)",
  },
  s4: {
    "color": "color-mix(in oklab, var(--muted-foreground) 80%, transparent)",
  },
  s5: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s6: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s7: {
    "width": "12px",
    "height": "12px",
  },
  s8: {
    "fontFamily": "var(--font-mono)",
  },
  s9: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s10: {
    "width": "8px",
    "height": "8px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// openHomeTerminal opens a terminal in box's home folder, as a tab over
// Home, and makes box the default next time.
export function openHomeTerminal(box: string) {
  rememberHomeBox(box);
  return startSession("", { kind: "tab" }, "Terminal", homeKey(box));
}

// newTerminal is ⌘T and "New terminal": in the worktree you are acting in
// (or the box whose home terminal has focus), as always; with neither, in a
// box's home, asking which box unless only one is online.
export function newTerminal() {
  if (here()) return void startSession("");
  const status = useStore.getState().status;
  const online = status?.boxes.filter((b) => b.state === "online") ?? [];
  if (online.length === 1) return void openHomeTerminal(online[0].name);
  // Before the boxes are known the picker opens anyway, and fills in.
  if (status && !status.boxes.length) {
    toastManager.add({ title: "No boxes yet", description: "Add a box to open a terminal on it." });
    return;
  }
  openBoxPicker();
}

interface Item {
  box: string;
  detail: string;
  blocked?: string;
  last: boolean;
}

// BoxPicker asks which box a new terminal opens on, when no worktree is in
// focus: every box with its state and load, the last one picked first (and
// highlighted, so ↵ opens it). A box that can't is listed, disabled, with
// why.
export function BoxPicker() {
  const open = useBoxPicker((s) => s.open);
  const status = useStore((s) => s.status);
  const boxes = useStore((s) => s.boxes);
  const [query, setQuery] = useState("");

  const items = useMemo<Item[]>(() => {
    if (!open) return [];
    const last = lastHomeBox();
    return pickableBoxes(status?.boxes ?? []).map(({ box, blocked }) => ({
      box: box.name,
      last: box.name === last && !blocked,
      blocked,
      detail: blocked ? reason(blocked) : [box.latency_ms !== undefined ? `${box.latency_ms} ms` : "", boxLoad(box.name)].filter(Boolean).join(" · "),
    }));
    // boxes: the load and capabilities pickableBoxes reads.
  }, [open, status, boxes]);
  const groups = [{ value: "boxes", items }];

  const close = () => {
    closeBoxPicker();
    setQuery("");
  };
  const pick = (box: string) => {
    close();
    void openHomeTerminal(box);
  };

  return (
    <CommandDialog open={open} onOpenChange={(o) => !o && close()}>
      <CommandDialogPopup aria-label="New terminal on a box">
        <Command items={groups} value={query} onValueChange={setQuery} itemToStringValue={(i: unknown) => (i as Item).box}>
          <CommandInput placeholder="New terminal on…" />
          <CommandPanel>
            <CommandEmpty>No box matches.</CommandEmpty>
            <CommandList>
              {(group: (typeof groups)[number]) => (
                <CommandGroup key={group.value} items={group.items}>
                  <CommandGroupLabel>Boxes</CommandGroupLabel>
                  <CommandCollection>
                    {(item: Item) => (
                      <CommandItem key={item.box} value={item} disabled={!!item.blocked} data-box={item.box} gap={2} onClick={() => pick(item.box)}>
                        <BoxDot box={item.box} />
                        <span className={sx(paint.s0)}>{item.box}</span>
                        {item.last && <span className={sx(paint.s1)}>last used</span>}
                        <span className={[sx(paint.s2), item.blocked ? sx(paint.s3) : sx(paint.s4)].filter(Boolean).join(" ")}>{item.detail}</span>
                      </CommandItem>
                    )}
                  </CommandCollection>
                </CommandGroup>
              )}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <span className={sx(paint.s5)}>
              <Kbd>↵</Kbd> open a terminal in its home
            </span>
            <span className={sx(paint.s6)}>
              <HouseIcon className={sx(paint.s7)} /> It opens on Home, in <span className={sx(paint.s8)}>~</span> <Kbd>esc</Kbd>
            </span>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}

// reason is why a box can't, in the list's few words.
function reason(blocked: string): string {
  if (blocked.endsWith("older berthd")) return "older berthd · update it first";
  if (blocked.endsWith("offline")) return "offline";
  if (blocked.endsWith("connecting")) return "connecting…";
  return blocked;
}

function BoxDot({ box }: { box: string }) {
  const state = useBoxState(box);
  return (
    <span className={sx(paint.s9)}>
      <StatusDot state={state} className={sx(paint.s10)} />
    </span>
  );
}
