import { CloudOffIcon, RotateCwIcon, ServerIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveTheme } from "@/hooks/use-theme";
import { startSession } from "@/lib/actions";
import type { TerminalConnection } from "@/lib/api";
import { agentLabel } from "@/lib/derive";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { openEditor } from "@/components/editors/open";
import { findPaths, resolveIn } from "@/lib/editor-paths";
import { createTerminal, type TermHandle } from "@/lib/terminal";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/lib/workspaces";

type ConnState = "connecting" | "open" | "reconnecting" | "offline" | "ended";

interface Props {
  box: string;
  session: string;
  // What ran here, remembered by the pane, for when the session is gone.
  agent?: string;
  command?: string;
  wsKey: string;
  tab: string;
  pane: string;
  visible: boolean;
  focused: boolean;
  onFocus(): void;
  onClose(): void;
}

// TerminalView is a pane attached to a session on a box. It stays mounted
// while hidden, so its screen and connection survive switching tabs and
// worktrees, and it reattaches on its own when the connection drops: the
// session keeps running on the box, and attaching again redraws it.
export function TerminalView({ box, session, agent, command, wsKey, tab, pane, visible, focused, onFocus, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState<TermHandle>();
  const conn = useRef<TerminalConnection>(null);
  const [state, setState] = useState<ConnState>("connecting");
  const [retry, setRetry] = useState(0);
  const theme = useActiveTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const prefs = usePrefs((p) => p.terminal);

  const client = useStore((s) => s.client);
  const boxState = useStore((s) => s.status?.boxes.find((b) => b.name === box)?.state);
  // True only once the box's sessions are known and this one is not among them.
  const gone = useStore((s) => s.boxes[box]?.sessions?.some((x) => x.name === session) === false);
  // The worktree the session runs in, which file paths are relative to.
  const dir = useStore((s) => s.boxes[box]?.sessions?.find((x) => x.name === session)?.dir);
  const dirRef = useRef(dir);
  dirRef.current = dir;

  // Create the terminal once per renderer, font and (for ghostty-web, which
  // cannot change colours in place yet) theme. Each one gets its own mount
  // node, removed with it, so a terminal still being created when the next
  // replaces it can never draw over its successor.
  useEffect(() => {
    let disposed = false;
    let t: TermHandle | undefined;
    const mount = document.createElement("div");
    mount.className = "h-full w-full";
    host.current!.appendChild(mount);
    void createTerminal(mount, themeRef.current.terminal, prefs).then((made) => {
      if (disposed) {
        made.dispose();
        return;
      }
      t = made;
      t.onData((d) => conn.current?.send(d));
      t.onResize(({ cols, rows }) => conn.current?.resize(cols, rows));
      // ⌘-click a file path to open it at its line in your editor.
      t.registerLinkFinder((line) => {
        const dir = dirRef.current;
        if (!dir) return [];
        return findPaths(line).flatMap((m) => {
          const file = resolveIn(dir, m.path);
          if (!file) return [];
          return [
            {
              start: m.start,
              end: m.end,
              activate: (e: MouseEvent) => {
                if (!e.metaKey && !e.ctrlKey) return;
                void openEditor({ box, path: dir, file, line: m.line, col: m.col });
              },
            },
          ];
        });
      });
      setTerm(t);
    });
    return () => {
      disposed = true;
      t?.dispose();
      mount.remove();
      setTerm(undefined);
    };
    // xterm takes a new theme in place (below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.renderer, prefs.fontFamily, prefs.fontSize, prefs.lineHeight, prefs.cursorStyle, prefs.cursorBlink, prefs.scrollback, prefs.renderer === "ghostty" ? theme.id : ""]);

  useEffect(() => term?.setTheme(theme.terminal), [term, theme]);

  // Keep the attachment up while the box is online and the session exists.
  // Each attach belongs to one terminal; output for an older one is dropped.
  useEffect(() => {
    if (!client || !term || !boxState) return;
    if (boxState !== "online") {
      setState("offline");
      return;
    }
    if (gone) {
      setState("ended");
      return;
    }
    let stopped = false;
    let attempt = 0;
    let timer = 0;
    const connect = () => {
      const mine: TerminalConnection = client.attach(box, session, term.cols, term.rows, {
        onOpen() {
          if (stopped) return;
          attempt = 0;
          // The box redraws the whole screen on attach; start from a clean one.
          term.reset();
          setState("open");
          mine.resize(term.cols, term.rows);
        },
        onData: (d) => {
          if (!stopped && conn.current === mine) term.write(d);
        },
        onClose(byUs) {
          if (byUs || stopped) return;
          setState("reconnecting");
          attempt++;
          timer = window.setTimeout(connect, Math.min(400 * 2 ** attempt, 10_000));
        },
      });
      conn.current = mine;
    };
    setState((s) => (s === "open" ? "reconnecting" : "connecting"));
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      conn.current?.close();
      conn.current = null;
    };
  }, [client, term, boxState, gone, box, session, retry]);

  // Fit to the pane whenever it is shown or resized.
  useEffect(() => {
    if (!visible || !term || !host.current) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => term.fit());
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [visible, term]);

  // Take the keyboard when this pane is shown and focused, but never from a
  // dialog, menu or field that has it: attaching finishes a moment after a
  // worktree is picked, often after ⌘N has opened a dialog.
  useEffect(() => {
    if (!visible || !focused || state !== "open" || !term) return;
    if (somethingElseHasFocus(host.current)) return;
    term.focus();
  }, [visible, focused, term, state]);

  const blocked = state === "offline" || state === "ended";
  return (
    <div className="relative min-h-0 flex-1" style={{ background: theme.terminal.background }} onMouseDown={onFocus}>
      <div ref={host} className={cn("absolute inset-0 overflow-hidden px-3 pt-2 pb-1 transition-opacity [&_canvas]:block", blocked && "pointer-events-none opacity-40")} />
      {state === "offline" && (
        <Card>
          <CloudOffIcon className="size-5 text-muted-foreground" />
          <p className="font-medium">{box} is offline</p>
          <p className="max-w-xs text-muted-foreground text-xs">The session keeps running there; Berth reconnects on its own when the box is back.</p>
          <div className="mt-1 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                void useStore.getState().refreshStatus();
                setRetry((n) => n + 1);
              }}
            >
              <RotateCwIcon />
              Retry now
            </Button>
            <Button size="sm" variant="outline" onClick={() => useStore.getState().setView({ kind: "settings", section: "boxes" })}>
              <ServerIcon />
              Boxes
            </Button>
          </div>
        </Card>
      )}
      {state === "ended" && <Ended box={box} session={session} agent={agent} command={command} wsKey={wsKey} tab={tab} pane={pane} onClose={onClose} />}
      {(state === "connecting" || state === "reconnecting") && (
        <div className="pointer-events-none absolute top-2 right-3 flex items-center gap-2 rounded-md border bg-popover/90 px-2 py-1 text-muted-foreground text-xs shadow-sm">
          <Spinner className="size-3" />
          {state === "reconnecting" ? `Reconnecting to ${box}…` : "Attaching…"}
        </div>
      )}
    </div>
  );
}

const OVERLAYS = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-slot=popover-popup], [data-berth-overlay]";

function somethingElseHasFocus(mine: HTMLElement | null): boolean {
  if (document.querySelector(OVERLAYS)) return true;
  const a = document.activeElement;
  if (!a || a === document.body || (mine && mine.contains(a))) return false;
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement || (a as HTMLElement).isContentEditable;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-popover/95 px-6 py-5 text-center text-sm shadow-lg/5">{children}</div>
    </div>
  );
}

// Ended says what stopped, and offers to start the same thing again in the
// same worktree, in this pane.
function Ended({ box, session, agent, command, wsKey, tab, pane, onClose }: { box: string; session: string; agent?: string; command?: string; wsKey: string; tab: string; pane: string; onClose(): void }) {
  const ref = useWorkspaces((s) => s.spaces[wsKey]?.ref);
  const what = agent ? agentLabel(agent) : "The shell";
  const where = ref ? (ref.main ? ref.location : ref.worktree) : box;
  return (
    <Card>
      <p className="font-medium">
        {what} in {where} has ended
      </p>
      <p className="font-mono text-muted-foreground text-xs">{session}</p>
      <div className="mt-1 flex gap-2">
        <Button size="sm" onClick={() => void startSession(command ?? "", { kind: "replace", tab, pane }, agent ? agentLabel(agent) : "Shell")}>
          <RotateCwIcon />
          Start {agent ? agentLabel(agent) : "a shell"} again
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close pane
        </Button>
      </div>
    </Card>
  );
}
