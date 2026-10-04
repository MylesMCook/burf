import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { openEditor } from "@/components/editors/open";
import { toggleShortcuts } from "@/components/shortcuts-sheet";
import { submitConfirm } from "@/components/sidebar/confirm";
import { toastManager } from "@/components/ui/toast";
import { closePane, openBrowserAt, startSession } from "@/lib/actions";
import { isTauri } from "@/lib/api";
import { toggleNotifications } from "@/lib/notifications";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { activateTab, currentSpace, moveFocus, useWorkspaces } from "@/lib/workspaces";
import { isOnboardingActive } from "@/views/onboarding/onboarding-state";

// The app's shortcuts (lib/shortcuts.json) come two ways: as keys, caught on
// the window before a terminal sees them, and, in the Mac app, from the menu
// bar, whose items carry the same keys so macOS cannot take them first (it
// takes ⌘. for "cancel" before the page sees it). Both end up in run.

type Dir = "left" | "right" | "up" | "down";
const arrows: Record<string, Dir> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

// run does what the shortcut id does and says whether it did anything, so a
// key that does nothing here goes on to the page. arg is the tab's number
// (tab) or the direction (focus).
function run(id: string, from: "key" | "menu", arg?: number | Dir): boolean {
  // Until onboarding is done there is nowhere else to go.
  if (isOnboardingActive()) return false;
  const s = useStore.getState();
  const ws = currentSpace();
  const wsKey = useWorkspaces.getState().current;
  const tab = ws?.tabs.find((t) => t.id === ws.active);
  const inWorkspace = s.view.kind === "workspace" && !!ws;

  switch (id) {
    case "new-worktree":
      s.openNewWorktree(ws ? { box: ws.ref.box, location: ws.ref.location } : {});
      return true;
    case "new-terminal":
      if (!ws) return false;
      void startSession("");
      return true;
    case "new-browser":
      if (!ws) return false;
      openBrowserAt("");
      return true;
    case "split-right":
    case "split-down":
      if (!inWorkspace || !tab) return false;
      void startSession("", { kind: "split", tab: tab.id, pane: tab.focus, dir: id === "split-down" ? "col" : "row" });
      return true;
    case "open-editor":
      if (!ws) return false;
      void openEditor({ box: ws.ref.box, path: ws.ref.path });
      return true;
    case "close-pane":
      // ⌘W again while "Close shell?" is open confirms it, as on macOS.
      if (submitConfirm()) return true;
      // Any other dialog: ⌘W does nothing, rather than close a pane behind it.
      if (document.querySelector("[role=dialog], [role=alertdialog]")) return true;
      if (!inWorkspace || !tab || !wsKey) return false;
      void closePane(wsKey, tab.id, tab.focus);
      return true;
    case "zen":
      if (usePrefs.getState().labs) usePrefs.setState((p) => ({ zen: !p.zen }));
      else if (from === "menu") toastManager.add({ title: "Zen is in Labs", description: "Turn on Labs in Settings → General to use it." });
      else return false;
      return true;
    case "sidebar":
      usePrefs.setState((p) => ({ sidebarCollapsed: !p.sidebarCollapsed }));
      return true;
    case "dashboard":
      s.setView({ kind: "dashboard" });
      return true;
    case "notifications":
      toggleNotifications();
      return true;
    case "palette":
      s.setPaletteOpen(!s.paletteOpen);
      return true;
    case "tab": {
      const t = ws?.tabs[Number(arg) - 1];
      if (!t || !wsKey) return false;
      activateTab(wsKey, t.id);
      return true;
    }
    case "focus":
      if (!inWorkspace) return false;
      moveFocus(arg as Dir);
      return true;
    case "shortcuts":
      toggleShortcuts();
      return true;
  }
  return false;
}

// One press can arrive both ways (the page's keydown, then the menu bar, or
// the other way round); the second is dropped so a toggle stays toggled.
let last: { what: string; from: string; at: number } | undefined;
export function runShortcut(id: string, from: "key" | "menu", arg?: number | Dir): boolean {
  const what = arg === undefined ? id : `${id}-${arg}`;
  const now = performance.now();
  if (last && last.what === what && last.from !== from && now - last.at < 400) return true;
  const did = run(id, from, arg);
  if (did) last = { what, from, at: now };
  return did;
}

// fromKey is the shortcut a keydown is, if any.
function fromKey(e: KeyboardEvent): [string, (number | Dir)?] | undefined {
  if (e.altKey) return e.key in arrows ? ["focus", arrows[e.key]] : undefined;
  const key = e.key.toLowerCase();
  const shift = e.shiftKey;
  if (key === ".") return ["zen"];
  if (key === "\\") return ["sidebar"];
  if (key === "/" && !shift) return ["shortcuts"];
  if (key === "k") return ["palette"];
  if (key === "n") return [shift ? "notifications" : "new-worktree"];
  if (key === "j") return ["dashboard"];
  if (key === "t" && !shift) return ["new-terminal"];
  if (key === "b" && shift) return ["new-browser"];
  if (key === "o" && shift) return ["open-editor"];
  if (key === "d") return [shift ? "split-down" : "split-right"];
  if (key === "w") return ["close-pane"];
  if (/^[1-9]$/.test(key)) return ["tab", Number(key)];
  return undefined;
}

// fromMenu is the shortcut a menu bar item's id is ("tab-3" is tab 3).
function fromMenu(id: string): [string, number?] {
  const m = /^tab-(\d)$/.exec(id);
  return m ? ["tab", Number(m[1])] : [id];
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // In the live demo on Windows and Linux, Ctrl stands in for ⌘.
      const meta = e.metaKey || (__BERTH_DEMO__ && e.ctrlKey && !/Mac|iPhone|iPad/.test(navigator.platform));
      if (!meta || (e.metaKey && e.ctrlKey)) return;
      const hit = fromKey(e);
      if (!hit || !runShortcut(hit[0], "key", hit[1])) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    // The Mac app's menu bar: each item sends its id (src-tauri/src/lib.rs).
    let unlisten: (() => void) | undefined;
    let gone = false;
    if (isTauri())
      void listen<string>("berth://menu", (e) => {
        const [id, arg] = fromMenu(e.payload);
        runShortcut(id, "menu", arg);
      }).then((u) => (gone ? u() : (unlisten = u)));
    return () => {
      gone = true;
      unlisten?.();
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, []);
}
