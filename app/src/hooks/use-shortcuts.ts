import { useEffect } from "react";

import { openEditor } from "@/components/editors/open";
import { closePane, openBrowserAt, startSession } from "@/lib/actions";
import { submitConfirm } from "@/components/sidebar/confirm";
import { toggleNotifications } from "@/lib/notifications";
import { isOnboardingActive } from "@/views/onboarding/onboarding-state";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { activateTab, currentSpace, moveFocus, useWorkspaces } from "@/lib/workspaces";

// The app's keys, caught on the window before a terminal sees them.
//
//   ⌘K palette        ⌘N new worktree     ⌘T new terminal    ⌘⇧B browser tab
//   ⌘D split right    ⌘⇧D split down      ⌘W close pane       ⌘1–9 tabs
//   ⌘⌥←↑→↓ move focus between panes       ⌘J agent dashboard
//   ⌘⇧O open the worktree in your editor   ⌘⇧N notifications
export const SHORTCUTS: [keys: string, what: string][] = [
  ["⌘K", "Search and commands"],
  ["⌘N", "New worktree"],
  ["⌘T", "New terminal in this worktree"],
  ["⌘⇧B", "New browser tab"],
  ["⌘D", "Split right"],
  ["⌘⇧D", "Split down"],
  ["⌘W", "Close the focused pane"],
  ["⌘⌥ ←↑→↓", "Move between panes"],
  ["⌘1–9", "Go to tab"],
  ["⌘J", "Agent dashboard"],
  ["⌘⇧N", "Notifications"],
  ["⌘⇧O", "Open this worktree in your editor"],
  ["⌘\\", "Show or hide the sidebar"],
];

const arrows: Record<string, "left" | "right" | "up" | "down"> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.ctrlKey) return;
      // Until onboarding is done there is nowhere else to go.
      if (isOnboardingActive()) return;
      const s = useStore.getState();
      const key = e.key.toLowerCase();
      const ws = currentSpace();
      const wsKey = useWorkspaces.getState().current;
      const tab = ws?.tabs.find((t) => t.id === ws.active);
      const inWorkspace = s.view.kind === "workspace" && !!ws;

      if (e.altKey) {
        if (!(e.key in arrows) || !inWorkspace) return;
        moveFocus(arrows[e.key]);
      } else if (key === "\\") {
        usePrefs.setState((p) => ({ sidebarCollapsed: !p.sidebarCollapsed }));
      } else if (key === "k") {
        s.setPaletteOpen(!s.paletteOpen);
      } else if (key === "n" && e.shiftKey) {
        toggleNotifications();
      } else if (key === "n") {
        s.openNewWorktree(ws ? { box: ws.ref.box, location: ws.ref.location } : {});
      } else if (key === "j") {
        s.setView({ kind: "dashboard" });
      } else if (key === "t" && !e.shiftKey && ws) {
        void startSession("");
      } else if (key === "b" && e.shiftKey && ws) {
        openBrowserAt("");
      } else if (key === "o" && e.shiftKey && ws) {
        void openEditor({ box: ws.ref.box, path: ws.ref.path });
      } else if (key === "d" && inWorkspace && tab) {
        void startSession("", { kind: "split", tab: tab.id, pane: tab.focus, dir: e.shiftKey ? "col" : "row" });
      } else if (key === "w" && submitConfirm()) {
        // ⌘W again while "Close shell?" is open confirms it, as on macOS.
      } else if (key === "w" && document.querySelector("[role=dialog], [role=alertdialog]")) {
        // Any other dialog: ⌘W does nothing, rather than close a pane behind it.
      } else if (key === "w" && inWorkspace && tab && wsKey) {
        void closePane(wsKey, tab.id, tab.focus);
      } else if (/^[1-9]$/.test(key) && ws && wsKey) {
        const t = ws.tabs[Number(key) - 1];
        if (!t) return;
        activateTab(wsKey, t.id);
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);
}
