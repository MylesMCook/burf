import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { RotateCwIcon, SquareIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useActiveTheme } from "@/hooks/use-theme";
import { type Client } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { localAgentName, localApi, type LocalSession } from "@/lib/local-computer";
import { usePrefs } from "@/lib/prefs";
import "@xterm/xterm/css/xterm.css";

export function LocalTerminal({ client, session, onChange }: { client: Client; session: LocalSession; onChange(session: LocalSession): void }) {
  const container = useRef<HTMLDivElement>(null);
  const theme = useActiveTheme();
  const colors = useRef(theme.terminal);
  colors.current = theme.terminal;
  const terminalRef = useRef<Terminal | null>(null);
  const prefs = usePrefs((s) => s.terminal);
  const latest = useRef(session);
  latest.current = session;
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [stopping, setStopping] = useState(false);
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.theme = { ...theme.terminal, cursorAccent: theme.terminal.background };
  }, [theme]);
  useEffect(() => {
    if (!container.current) return;
    const controller = new AbortController();
    const signal = controller.signal;
    const terminal = new Terminal({ cursorBlink: prefs.cursorBlink, cursorStyle: prefs.cursorStyle, fontFamily: prefs.fontFamily, fontSize: prefs.fontSize, lineHeight: prefs.lineHeight, scrollback: Math.min(prefs.scrollback, 10000), minimumContrastRatio: 4.5, theme: { ...colors.current, cursorAccent: colors.current.background }, allowProposedApi: false });
    terminalRef.current = terminal;
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container.current);
    terminal.textarea?.setAttribute("aria-label", "Local agent terminal");
    let timer: ReturnType<typeof setTimeout>;
    let resizeTimer: ReturnType<typeof setTimeout>;
    let after = 0;
    let failed = false;
    let queued = 0;
    let writes = Promise.resolve();
    setError("");
    const fail = (e: unknown) => {
      if (signal.aborted) return;
      failed = true;
      terminal.options.disableStdin = true;
      setError(errorMessage(e));
    };
    const resize = () => {
      if (signal.aborted || failed || latest.current.state !== "running") return;
      fit.fit();
      void localApi.resize(client, session.id, terminal.cols, terminal.rows, signal).catch(fail);
    };
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 100);
    });
    observer.observe(container.current);
    const input = terminal.onData((data) => {
      if (signal.aborted || failed || latest.current.state !== "running") return;
      if (queued + data.length > 65536) { fail(new Error("Terminal input queue is full. Reconnect before sending more.")); return; }
      queued += data.length;
      // HTTP completion orders keystrokes; parallel POSTs can reorder them.
      writes = writes.then(async () => {
        if (!signal.aborted && !failed) await localApi.input(client, session.id, data, signal);
      }).catch(fail).finally(() => { queued -= data.length; });
    });
    const poll = async () => {
      try {
        const result = await localApi.output(client, session.id, after, signal);
        if (signal.aborted) return;
        if (result.reset) terminal.reset();
        if (result.data) {
          const bytes = Uint8Array.from(atob(result.data), (ch) => ch.charCodeAt(0));
          await new Promise<void>((resolve) => terminal.write(bytes, resolve));
        }
        if (signal.aborted) return;
        after = result.next;
        terminal.options.disableStdin = result.state === "exited" || failed;
        if (latest.current.state !== result.state || latest.current.exit_error !== result.exit_error) onChange({ ...latest.current, state: result.state, exit_error: result.exit_error });
        if (result.state === "running" && !failed) timer = setTimeout(() => void poll(), 250);
      } catch (e) { fail(e); }
    };
    fit.fit();
    terminal.focus();
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      clearTimeout(resizeTimer);
      observer.disconnect();
      input.dispose();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [client, session.id, attempt, onChange, prefs]);

  return <>
    <div className="flex min-w-0 flex-wrap items-center gap-3 border-b px-4 py-2">
      <h2 className="text-sm font-medium">{localAgentName(session.agent)}</h2><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={session.cwd}>{session.cwd}</span><span className="text-xs text-muted-foreground">{session.state}</span>
      {session.state === "running" && <Button size="sm" variant="outline" disabled={stopping} onClick={async () => {
        setStopping(true); setError("");
        try { await localApi.stop(client, session.id); onChange({ ...session, state: "exited" }); }
        catch (e) { setError(errorMessage(e)); }
        finally { setStopping(false); }
      }}><SquareIcon />Stop agent</Button>}
    </div>
    {(error || session.exit_error) && <div role="alert" className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm text-destructive"><span className="min-w-0 flex-1 break-words">{error || session.exit_error}</span>{error && <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}><RotateCwIcon />Reconnect terminal</Button>}</div>}
    <div ref={container} data-testid="local-terminal" className="min-h-0 flex-1 overflow-hidden bg-background p-2 text-foreground" />
  </>;
}
