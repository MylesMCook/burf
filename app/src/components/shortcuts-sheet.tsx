import * as stylex from "@stylexjs/stylex";
import { create } from "zustand";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ZoomHud } from "@/components/zoom-hud";
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { isDesktop } from "@/lib/api";
import { IS_LINUX, LINUX_TERMINAL_KEYS } from "@/lib/platform";
import { usePrefs } from "@/lib/prefs";
import { describe, SHORTCUT_GROUPS, SHORTCUTS } from "@/lib/shortcuts";
import { useStore } from "@/lib/store";

const paint = stylex.create({
  s0: {
    "marginBottom": "4px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "display": "flex",
    "flexDirection": "column",
  },
  s2: {
    "display": "flex",
    "minHeight": "30px",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": {
      "default": 1,
      ":last-child": 0,
    },
    "borderBottomStyle": {
      "default": "solid",
      ":last-child": "solid",
    },
    "borderBottomColor": {
      "default": "var(--border)",
      ":last-child": "var(--border)",
    },
    "borderStyle": "dashed",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s4: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The Keyboard shortcuts sheet (Help → Keyboard shortcuts, ⌘/, or ⌘K): every
// shortcut, grouped as the menu bar groups them, from the same table.

const useShortcutsSheet = create<{ open: boolean }>()(() => ({ open: false }));
export const toggleShortcuts = () => useShortcutsSheet.setState((s) => ({ open: !s.open }));
export const openShortcuts = () => useShortcutsSheet.setState({ open: true });

export function ShortcutsSheet() {
  const open = useShortcutsSheet((s) => s.open);
  const labs = usePrefs((p) => p.labs);
  const close = () => useShortcutsSheet.setState({ open: false });
  return (
    <Sheet open={open} onOpenChange={(o) => useShortcutsSheet.setState({ open: o })}>
      {/* The zoom HUD (⌘+, ⌘−, ⌘0) lives with the sheet that lists those keys. */}
      <ZoomHud />
      <SheetPopup width="sm">
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>
            {IS_LINUX ? (
              LINUX_TERMINAL_KEYS
            ) : (
              <>
                They work everywhere in the window, terminals included.{" "}
                {isDesktop() ? "You’ll find them in the menu bar too, under File, View, Go and Help." : "In the desktop app they’re in the menu bar too."}
              </>
            )}
          </SheetDescription>
        </SheetHeader>
        <SheetPanel stack={4}>
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group} aria-label={group}>
              <h3 className={sx(paint.s0)}>{group}</h3>
              <ul className={sx(paint.s1)}>
                {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <li key={s.id} className={sx(paint.s2)}>
                    <span className={sx(paint.s3)}>{describe(s)}</span>
                    {s.labs && !labs && <Badge variant="outline">Labs</Badge>}
                    <span className={sx(paint.s4)}><Kbd>{s.keys}</Kbd></span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </SheetPanel>
        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => {
              close();
              useStore.getState().setView({ kind: "settings", section: "shortcuts" });
            }}
          >
            Search them in Settings
          </Button>
          <Button onClick={close}>Done</Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
