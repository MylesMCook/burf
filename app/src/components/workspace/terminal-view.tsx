import { useEffect, useRef, useState } from "react";

import { toastError } from "@/components/error-note";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { BoxOffline, SessionEnded } from "@/components/workspace/pane-state";
import { ServiceStopped } from "@/components/workspace/service-terminal";
import { useActiveTheme } from "@/hooks/use-theme";
import { ApiError, type TerminalConnection } from "@/lib/api";
import { attachable, localPaths, named, onThisComputer, pastedFiles, shrinkImage, uploadAttachment, uploadLocalFile } from "@/lib/attachments";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { openEditor } from "@/components/editors/open";
import { findPaths, resolveIn } from "@/lib/editor-paths";
import { OVERLAYS } from "@/lib/overlays";
import { createTerminal, type TermHandle } from "@/lib/terminal";
import { cn } from "@/lib/utils";

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
  // True only once the box's sessions are known and this one is not among
  // them, or is listed as exited: there is nothing live to attach to, so the
  // pane shows the ended state rather than a terminal that seems to run.
  // A service's terminal stays when its program ends, with what it printed,
  // to start it again in.
  const gone = useStore((s) => {
    const list = s.boxes[box]?.sessions;
    if (!list) return false;
    const x = list.find((y) => y.name === session);
    return !x || (x.exited && !x.service);
  });
  const stoppedService = useStore((s) => {
    const x = s.boxes[box]?.sessions?.find((y) => y.name === session);
    return x?.service && x.exited ? x : undefined;
  });
  // Where the box is: one on this computer reads a pasted laptop path as is.
  const address = useStore((s) => s.status?.boxes.find((b) => b.name === box)?.address);
  const addressRef = useRef(address);
  addressRef.current = address;
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

  // A pasted or dropped image (a PDF, a text file, a file copied in Finder)
  // can't be typed: it goes up to the session's worktree on the box and its
  // path is pasted instead, which Claude Code takes as the image. Text pastes
  // as ever, through the terminal.
  useEffect(() => {
    const el = host.current;
    if (!el || !term || !client) return;
    // files are pasted files, or paths on this computer pasted as text
    // (text is pasted as it was if they aren't files here after all).
    // A pasted screenshot is made smaller first (lib/attachments); a
    // dropped file goes as it is.
    const take = async (given: (File | string)[], text?: string, pasted = false) => {
      const files = given.map((f) => (typeof f === "string" ? f : named(f)));
      let shown: string | undefined;
      const first = typeof files[0] === "string" ? (files[0].split("/").pop() ?? files[0]) : files[0].name;
      const slow = window.setTimeout(() => {
        shown = toastManager.add({ type: "loading", title: files.length === 1 ? `Uploading ${first} to ${box}…` : `Uploading ${files.length} files to ${box}…`, timeout: 0 });
      }, 400);
      try {
        const done = await Promise.all(files.map(async (f) => (typeof f === "string" ? uploadLocalFile(client, { box, session }, f) : uploadAttachment(client, { box, session }, pasted ? await shrinkImage(f) : f))));
        term.paste(done.map((a) => a.path.replaceAll(" ", "\\ ")).join(" "));
        term.focus();
      } catch (err) {
        const notHere = err instanceof ApiError && ((err.code === "attach_local" && /^no file at/.test(err.message)) || (err.status === 404 && !err.code));
        if (text !== undefined && notHere) term.paste(text);
        else toastError(err, { title: "Couldn't paste the file", box });
      } finally {
        window.clearTimeout(slow);
        if (shown) toastManager.close(shown);
      }
    };
    const files = (data: DataTransfer | null) => pastedFiles(data).filter(attachable);
    const onPaste = (e: ClipboardEvent) => {
      const fs = files(e.clipboardData);
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const paths = fs.length || onThisComputer(addressRef.current) ? [] : localPaths(text);
      if (!fs.length && !paths.length) return;
      e.preventDefault();
      e.stopPropagation();
      void (fs.length ? take(fs, undefined, true) : take(paths, text));
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const fs = files(e.dataTransfer);
      if (!fs.length) return;
      e.preventDefault();
      void take(fs);
    };
    el.addEventListener("paste", onPaste, true);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("paste", onPaste, true);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
    };
  }, [term, client, box, session]);

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
  // The keyboard also comes back here when it falls to the page itself: a
  // dialog that closed with nowhere to return to, or a neighbouring pane
  // that was closed while it had it.
  useEffect(() => {
    if (!visible || !focused || state !== "open" || !term) return;
    if (!somethingElseHasFocus(host.current)) term.focus();
    let frame = 0;
    const reclaim = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const a = document.activeElement;
        if ((!a || a === document.body) && !somethingElseHasFocus(host.current)) term.focus();
      });
    };
    document.addEventListener("focusout", reclaim);
    return () => {
      document.removeEventListener("focusout", reclaim);
      cancelAnimationFrame(frame);
    };
  }, [visible, focused, term, state]);

  // What looks focused is what has the keyboard: a terminal that gets it
  // without a click (a script, the browser) becomes the focused pane.
  // The wheel goes to tmux as a mouse wheel, the way a native terminal sends
  // it once tmux turns mouse reporting on. ghostty-web doesn't report the
  // mouse, so over a full-screen program (Claude Code draws in the alternate
  // screen) it turned the wheel into arrow keys, which Claude reads as its
  // prompt history. tmux then does the right thing: a program that asked
  // for the mouse scrolls itself; anything else scrolls tmux's history.
  useEffect(() => {
    const el = host.current;
    if (!el || !term || !visible) return;
    let pending = 0;
    const onWheel = (e: WheelEvent) => {
      // Shift-scroll stays the terminal's own (selection, sideways).
      if (e.shiftKey || !conn.current) return;
      e.preventDefault();
      e.stopPropagation();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
      pending += px;
      const rect = el.getBoundingClientRect();
      const col = Math.min(term.cols, Math.max(1, Math.floor(((e.clientX - rect.left) / rect.width) * term.cols) + 1));
      const row = Math.min(term.rows, Math.max(1, Math.floor(((e.clientY - rect.top) / rect.height) * term.rows) + 1));
      // One wheel step per ~40px, so a trackpad doesn't fling the view.
      while (Math.abs(pending) >= 40) {
        const up = pending < 0;
        conn.current.send(`\x1b[<${up ? 64 : 65};${col};${row}M`);
        pending += up ? 40 : -40;
      }
    };
    el.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, [term, visible]);

  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  useEffect(() => {
    const el = host.current;
    if (!el || !visible) return;
    const claim = () => {
      if (!focusedRef.current) onFocusRef.current();
    };
    el.addEventListener("focusin", claim);
    return () => el.removeEventListener("focusin", claim);
  }, [visible]);

  const blocked = state === "offline" || state === "ended";
  return (
    <div className="relative min-h-0 flex-1" style={{ background: theme.terminal.background }} onMouseDown={onFocus}>
      <div ref={host} data-terminal className={cn("absolute inset-0 overflow-hidden px-3 pt-2 pb-1 transition-opacity [&_canvas]:block", blocked && "pointer-events-none", state === "offline" && "opacity-40", state === "ended" && "invisible")} />
      {state === "offline" && <BoxOffline box={box} state={boxState} onRetry={() => setRetry((n) => n + 1)} />}
      {stoppedService && state !== "ended" && state !== "offline" && <ServiceStopped box={box} session={stoppedService} />}
      {state === "ended" && <SessionEnded box={box} session={session} agent={agent} command={command} wsKey={wsKey} tab={tab} pane={pane} onClose={onClose} />}
      {(state === "connecting" || state === "reconnecting") && (
        <div className="pointer-events-none absolute top-2 right-3 flex items-center gap-2 rounded-md border bg-popover/90 px-2 py-1 text-muted-foreground text-xs shadow-sm">
          <Spinner className="size-3" />
          {state === "reconnecting" ? `Reconnecting to ${box}…` : "Attaching…"}
        </div>
      )}
    </div>
  );
}

function somethingElseHasFocus(mine: HTMLElement | null): boolean {
  if (document.querySelector(OVERLAYS)) return true;
  const a = document.activeElement;
  if (a?.closest(OVERLAYS)) return true;
  if (!a || a === document.body || (mine && mine.contains(a))) return false;
  // Another terminal is editable too, but the focused pane is this one.
  if (a.closest("[data-terminal]")) return false;
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement || (a as HTMLElement).isContentEditable;
}
