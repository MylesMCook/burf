import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeftIcon, ArrowUpRightIcon, ArrowRightIcon, BotIcon, CrosshairIcon, ExternalLinkIcon, GlobeIcon, RotateCwIcon, SendIcon, XIcon } from "lucide-react";
import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { isTauri } from "@/lib/api";
import { agentBrowserStatus, type AgentBrowserStatus, boxHasBrowser, type Frame, watchAgentBrowser } from "@/lib/agent-browser";
import { agentOf } from "@/lib/derive";
import { send as sendPrompt } from "@/lib/orchestrate";
import { PICKER_SCRIPT, type Pick, parsePick, pickMessage } from "@/lib/picker";
import { toastManager } from "@/components/ui/toast";
import { berthUrlLabel, type BrowserContext, describeBerthUrl, hostSuffix, resolveBrowserInput, suggestions, worktreeHost } from "@/lib/browser-url";
import { openUrl } from "@/lib/open-url";
import { overlayOpen } from "@/lib/overlays";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { demoDevServer } from "@/demo/dev-server";
import { currentSpace, rememberUrl, useWorkspaces } from "@/lib/workspaces";

interface Props {
  // The pane's id. Child webviews are keyed by it, so pass the pane's own id
  // to keep the page when the pane moves within the layout.
  id?: string;
  url: string;
  visible: boolean;
  onNavigate(url: string): void;
}

type Mode = "native" | "iframe";

// BrowserPane shows a web page in a pane, mostly a box's dev server through
// the laptop's proxy (a worktree's own name, like
// http://checkout.shop.devl.localhost:1377/). In the app it is a native child
// webview laid over the pane, so every page works as in a browser; in a plain
// browser, or when that fails, it is an iframe.
export function BrowserPane({ id: paneId, url, visible, onNavigate }: Props) {
  const fallbackId = useId();
  const id = useMemo(() => (paneId ?? fallbackId).replace(/[^A-Za-z0-9_-]/g, ""), [paneId, fallbackId]);
  const [mode, setMode] = useState<Mode>(isTauri() ? "native" : "iframe");
  const [failure, setFailure] = useState<string>();
  const [input, setInput] = useState(url);
  const [loading, setLoading] = useState(false);
  const ctx = useBrowserContext();
  // Select the stable list and derive from it: a selector that builds a new
  // array every time never lets the store settle.
  const boxes = useStore((s) => s.status?.boxes);
  const where = useMemo(() => (url ? describeBerthUrl(url, (boxes ?? []).map((b) => b.name)) : undefined), [url, boxes]);

  // The iframe keeps its own history of addresses entered here; the native
  // webview has the page's real history.
  const [history, setHistory] = useState<string[]>(url ? [url] : []);
  const [at, setAt] = useState(url ? 0 : -1);
  const [nonce, setNonce] = useState(0);
  const native = useRef<NativeView>(null);
  const address = useRef<HTMLInputElement>(null);

  useEffect(() => setInput(url), [url]);

  // A new, empty tab (⌘⇧B) is for typing an address: take the keyboard from
  // the terminal that had it, though never from a dialog or menu. The next
  // frame, after the pane is shown.
  useEffect(() => {
    if (!visible || url) return;
    const frame = requestAnimationFrame(() => {
      if (!overlayOpen()) address.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
    // Only as the empty tab is shown, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const go = (next: string) => {
    rememberUrl(next);
    if (mode === "iframe") {
      setHistory((h) => [...h.slice(0, at + 1), next]);
      setAt((i) => i + 1);
    }
    onNavigate(next);
  };

  const step = (d: -1 | 1) => {
    if (mode === "native") return native.current?.step(d);
    const i = at + d;
    if (i < 0 || i >= history.length) return;
    setAt(i);
    onNavigate(history[i]);
  };

  const reload = () => (mode === "native" ? native.current?.reload() : setNonce((n) => n + 1));

  // You see your own tab; Agent shows the agent's browser on the box, live,
  // for a worktree whose box has one.
  const agentCapable = !!ctx.ref && boxHasBrowser(ctx.ref.box);
  const [view, setView] = useState<"you" | "agent">("you");
  const agentView = agentCapable && view === "agent";
  const [picked, setPicked] = useState<Pick>();

  // A pick from the native webview comes back as an event.
  useEffect(() => {
    if (mode !== "native") return;
    let stop: (() => void) | undefined;
    let gone = false;
    void listen<{ id: string; url: string }>("berth://browser-pick", (e) => {
      if (e.payload.id !== id) return;
      const p = parsePick(e.payload.url);
      if (p) setPicked(p);
    }).then((un) => (gone ? un() : (stop = un)));
    return () => {
      gone = true;
      stop?.();
    };
  }, [id, mode]);

  const pick = () => {
    if (mode === "native") {
      void invoke("browser_pick", { id, script: PICKER_SCRIPT }).catch((err) => toastManager.add({ type: "error", title: "Couldn't start the picker", description: String(err) }));
      return;
    }
    // A frame: only a page the frame may script (same origin).
    const frame = document.querySelector<HTMLIFrameElement>(`iframe[data-pane="${id}"]`);
    try {
      const w = frame?.contentWindow as (Window & { eval(js: string): void }) | null;
      if (!w) throw new Error("no page");
      (window as unknown as { __berthPick?: (p: Pick) => void }).__berthPick = (p: Pick) => setPicked(p);
      w.eval(PICKER_SCRIPT);
    } catch {
      toastManager.add({ type: "info", title: "This page can't be picked from here", description: "Picking works in the Berth app's own browser panes." });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <form
        className="flex h-9 shrink-0 items-center gap-1 border-b px-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = resolveBrowserInput(input, ctx);
          if (next) go(next);
        }}
      >
        <ToolButton label="Back" disabled={!url || (mode === "iframe" && at <= 0)} onClick={() => step(-1)}>
          <ArrowLeftIcon />
        </ToolButton>
        <ToolButton label="Forward" disabled={!url || (mode === "iframe" && at >= history.length - 1)} onClick={() => step(1)}>
          <ArrowRightIcon />
        </ToolButton>
        <ToolButton label="Reload" disabled={!url} onClick={reload}>
          {loading ? <Spinner className="size-3.5" /> : <RotateCwIcon />}
        </ToolButton>
        <div className="flex h-6.5 min-w-0 flex-1 items-center rounded-md border bg-muted/50 focus-within:border-ring">
          {where && (
            // Tooltips here open upward: below the bar is the page, which in
            // the app is a native view that would cover them.
            <Tip label={<span className="break-all font-mono">{url}</span>} className="max-w-md">
              <span className="ml-1 shrink-0 rounded bg-accent px-1.5 py-px font-medium text-[10px] text-muted-foreground">{berthUrlLabel(where)}</span>
            </Tip>
          )}
          <input
            ref={address}
            aria-label="Address"
            value={input}
            placeholder="Port (3000), or a URL"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(e) => setInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-xs outline-none"
          />
        </div>
        {!agentView && (
          <ToolButton label="Pick an element for the agent" disabled={!url} onClick={pick}>
            <CrosshairIcon />
          </ToolButton>
        )}
        <ToolButton label="Open in your browser" disabled={!url} onClick={() => void openUrl(url)}>
          <ExternalLinkIcon />
        </ToolButton>
        {agentCapable && (
          <div className="ml-1 flex shrink-0 rounded-md border p-px text-[11px]" role="group" aria-label="Whose browser">
            {(["you", "agent"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn("inline-flex h-5.5 items-center gap-1 rounded px-1.5 text-muted-foreground", view === v && "bg-accent text-foreground")}
              >
                {v === "agent" && <BotIcon className="size-3" />}
                {v === "you" ? "You" : "Agent"}
              </button>
            ))}
          </div>
        )}
      </form>
      {picked && ctx.ref && <PickSender pick={picked} ctx={ctx} onDone={() => setPicked(undefined)} />}
      {failure && mode === "iframe" && <p className="shrink-0 border-b bg-muted/40 px-3 py-1 text-muted-foreground text-xs">The built-in browser could not open ({failure}); showing the page in a frame instead.</p>}
      {agentView && ctx.ref ? (
        <AgentView
          ctx={ctx}
          visible={visible}
          onOpenHere={(u) => {
            setView("you");
            go(u);
          }}
        />
      ) : !url ? (
        <Suggestions ctx={ctx} onPick={go} />
      ) : mode === "native" ? (
        <NativeSurface
          ref={native}
          id={id}
          url={url}
          visible={visible && !agentView}
          onUrl={(u) => {
            setInput(u);
            if (u !== url) onNavigate(u);
          }}
          onLoading={setLoading}
          onFail={(why) => {
            setFailure(why);
            setMode("iframe");
          }}
        />
      ) : (
        <FramedPage key={`${url}#${nonce}`} id={id} url={url} onReload={reload} />
      )}
    </div>
  );
}

// useBrowserContext gathers what resolving a typed port needs: the shown
// worktree, its box's services, and the proxy's URL port.
function useBrowserContext(): BrowserContext {
  const ref = currentSpace()?.ref;
  const services = useStore((s) => (ref ? s.boxes[ref.box]?.services : undefined));
  const urlPort = useStore((s) => s.status?.proxy.url_port);
  return { ref, services, urlPort };
}

interface NativeView {
  step(d: -1 | 1): void;
  reload(): void;
}

interface NativeProps {
  id: string;
  url: string;
  visible: boolean;
  onUrl(url: string): void;
  onLoading(loading: boolean): void;
  onFail(why: string): void;
  ref: React.Ref<NativeView>;
}

interface Navigated {
  id: string;
  url: string;
  state: "started" | "finished";
}

// NativeSurface reserves the pane's space and keeps a child webview of the
// same size on top of it: open on mount, follow every move and resize, hide
// while the pane is hidden or one of the app's own popups is open (a native
// view would cover it), and close on unmount.
function NativeSurface({ id, url, visible, onUrl, onLoading, onFail, ref }: NativeProps) {
  const surface = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  // Every call waits for the ones before it, so a hide or a resize never
  // reaches the webview before the open that creates it.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const send = (cmd: string, args: Record<string, unknown> = {}) => {
    const next = queue.current.then(() => call(cmd, { id, ...args }));
    queue.current = next.catch(() => {});
    return next;
  };
  // The URL the webview itself last reported, so a navigation it made is not
  // sent back to it as a new one.
  const reported = useRef<string>(undefined);
  const overlay = useAppOverlay();
  const shown = visible && !overlay;
  const callbacks = useRef({ onUrl, onLoading, onFail });
  callbacks.current = { onUrl, onLoading, onFail };

  useImperativeHandle(ref, () => ({ step: (d) => void send(d < 0 ? "browser_back" : "browser_forward"), reload: () => void send("browser_reload") }), [id]);

  // Follow the page's own navigations.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let gone = false;
    void listen<Navigated>("berth://browser", (e) => {
      if (e.payload.id !== id) return;
      callbacks.current.onLoading(e.payload.state === "started");
      if (e.payload.state === "finished") {
        reported.current = e.payload.url;
        callbacks.current.onUrl(e.payload.url);
      }
    }).then((un) => (gone ? un() : (stop = un)));
    return () => {
      gone = true;
      stop?.();
    };
  }, [id]);

  // Open once; navigate when the pane's URL changes from outside.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    if (!opened.current) {
      const r = bounds(el);
      opened.current = true;
      send("browser_open", { url, ...r }).catch((err) => {
        opened.current = false;
        callbacks.current.onFail(String(err));
      });
      return;
    }
    if (url !== reported.current) void send("browser_navigate", { url });
  }, [id, url]);

  // Close with the pane.
  useEffect(() => {
    return () => {
      opened.current = false;
      void send("browser_close");
    };
  }, [id]);

  // Show and place it while the pane is on screen; positions change without
  // sizes changing (a sidebar toggling), so a cheap rect check runs too.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    if (!shown) {
      void send("browser_hide");
      return;
    }
    let last = "";
    const sync = () => {
      const r = bounds(el);
      const key = `${r.x},${r.y},${r.w},${r.h}`;
      if (key === last) return;
      last = key;
      void send("browser_set_bounds", r);
    };
    sync();
    void send("browser_show");
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    const timer = window.setInterval(sync, 250);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.clearInterval(timer);
    };
  }, [id, shown]);

  return (
    <div ref={surface} className="relative min-h-0 flex-1 bg-white">
      {overlay && visible && <div className="absolute inset-0 bg-background/40" />}
    </div>
  );
}

function bounds(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
}

function call(cmd: string, args: Record<string, unknown>) {
  return invoke(cmd, args).catch((err) => {
    // A pane closing while its window tears down, or a hide before the
    // webview exists, is not worth more than a debug line.
    if (cmd === "browser_open") throw err;
    console.debug(`${cmd}:`, err);
  });
}

// useAppOverlay is true while any of the app's own menus, dialogs or popups is
// open. Native webviews sit above the app's page, so a browser pane must step
// aside for them.
const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-berth-overlay]';

function useAppOverlay(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(document.querySelector(OVERLAY) !== null);
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role", "data-berth-overlay"] });
    return () => mo.disconnect();
  }, []);
  return open;
}

function ToolButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn("inline-flex size-6.5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent [&_svg]:size-3.5")}
      >
        {children}
      </button>
    </Tip>
  );
}

// isLocal is a page the laptop serves or proxies, which a frame can show;
// most other sites refuse to be framed.
function isLocal(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost");
  } catch {
    return false;
  }
}

// FramedPage shows a page in an iframe, where the native view is not
// available (a plain browser, or when it failed). Sites that refuse to be
// framed would show the browser's own grey error, so they get a designed
// fallback instead, as does a page that never finishes loading.
function FramedPage({ id, url, onReload }: { id: string; url: string; onReload(): void }) {
  const [state, setState] = useState<"loading" | "loaded" | "stuck" | "blocked">(isLocal(url) ? "loading" : "blocked");
  useEffect(() => {
    if (state !== "loading") return;
    const t = window.setTimeout(() => setState("stuck"), 15_000);
    return () => window.clearTimeout(t);
  }, [state]);

  if (state === "blocked" || state === "stuck") {
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    })();
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
          <GlobeIcon className="size-6 text-muted-foreground" />
          <p className="font-medium text-sm">{state === "blocked" ? `${host} can't be shown inside Berth` : `${host} isn't loading`}</p>
          <p className="text-muted-foreground text-xs">
            {state === "blocked" ? "Most sites refuse to be embedded in other apps. Open it in your browser instead." : "It has not answered in 15 seconds. It may still be starting, or it may refuse to be embedded."}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => void openUrl(url)}>
              <ExternalLinkIcon />
              Open in your browser
            </Button>
            {!__BERTH_DEMO__ && <Button size="sm" variant="ghost" onClick={state === "blocked" ? () => setState("loading") : onReload}>
              {state === "blocked" ? "Try here anyway" : "Reload"}
            </Button>}
          </div>
        </div>
      </div>
    );
  }
  // The live demo has no dev servers and loads nothing from elsewhere: a
  // box's page is a stand-in drawn here, and other sites stay blocked.
  return (
    <iframe
      data-pane={id}
      src={__BERTH_DEMO__ ? undefined : url}
      srcDoc={__BERTH_DEMO__ ? demoDevServer(url) : undefined}
      title={url}
      onLoad={() => setState("loaded")}
      className="min-h-0 flex-1 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
    />
  );
}

// Suggestions offers the current worktree's dev servers, by the names the
// proxy knows them by, and pages opened recently, right under the address
// bar where the eye already is.
function Suggestions({ ctx, onPick }: { ctx: BrowserContext; onPick(url: string): void }) {
  const list = suggestions(ctx);
  const recent = useWorkspaces((s) => s.recentUrls).slice(0, 5);
  const Row = ({ url, title, note }: { url: string; title: string; note?: string }) => (
    <button key={url} type="button" onClick={() => onPick(url)} className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{title}</span>
        {note && <span className="block truncate font-mono text-muted-foreground text-xs">{note}</span>}
      </span>
      <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground opacity-50 group-hover:opacity-100" />
    </button>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pt-12 pb-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        {list.length > 0 && (
          <section>
            <p className="mb-1 px-3 font-medium text-muted-foreground text-xs">Running in this worktree</p>
            {list.map((s) => (
              <Row key={s.port} url={s.url} title={`${s.port}${s.process ? ` · ${s.process}` : ""}`} note={s.url} />
            ))}
          </section>
        )}
        {recent.length > 0 && (
          <section>
            <p className="mb-1 px-3 font-medium text-muted-foreground text-xs">Recent</p>
            {recent.map((u) => (
              <Row key={u} url={u} title={u.replace(/^https?:\/\//, "").replace(/\/$/, "")} />
            ))}
          </section>
        )}
        {list.length === 0 && recent.length === 0 && (
          <p className="px-3 text-center text-muted-foreground text-xs">Type a port to open this worktree's dev server on {ctx.ref?.box ?? "its box"}, or any URL.</p>
        )}
      </div>
    </div>
  );
}

// humanUrl is the agent's URL as this laptop names the worktree: the agent's
// browser may call the box by another name, so its path is kept and the
// host is the one this laptop's proxy knows.
function humanUrl(agentUrl: string, ctx: BrowserContext): string {
  try {
    const u = new URL(agentUrl);
    const host = ctx.ref && worktreeHost(ctx.ref);
    if (!host || !u.hostname.endsWith(".localhost")) return agentUrl;
    return `http://${host}${hostSuffix(ctx.urlPort)}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return agentUrl;
  }
}

// AgentView shows the agent's browser on the box, live: frames stream only
// while this view is on screen.
function AgentView({ ctx, visible, onOpenHere }: { ctx: BrowserContext; visible: boolean; onOpenHere(url: string): void }) {
  const ref = ctx.ref!;
  const [status, setStatus] = useState<AgentBrowserStatus>();
  const [frame, setFrame] = useState<Frame>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!visible) return;
    let live = true;
    const tick = () =>
      agentBrowserStatus(ref.box, ref.location, ref.worktree).then(
        (s) => live && setStatus(s),
        (e) => live && setError(String(e)),
      );
    void tick();
    const t = window.setInterval(tick, 4000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [visible, ref.box, ref.location, ref.worktree]);
  const running = !!status?.running;
  useEffect(() => {
    if (!visible || !running) return;
    const ac = new AbortController();
    watchAgentBrowser(ref.box, ref.location, ref.worktree, setFrame, ac.signal).catch(() => {});
    return () => ac.abort();
  }, [visible, running, ref.box, ref.location, ref.worktree]);
  const agentUrl = frame?.url ?? status?.status?.url;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/30">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b px-3 text-[11px] text-muted-foreground">
        <BotIcon className="size-3" />
        <span className="min-w-0 flex-1 truncate font-mono">{running ? (agentUrl ?? "…") : "The agent's browser is closed"}</span>
        {running && agentUrl && (
          <button type="button" className="shrink-0 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground" onClick={() => onOpenHere(humanUrl(agentUrl, ctx))}>
            Open here
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
        {error ? (
          <p className="text-muted-foreground text-xs">{error}</p>
        ) : !running ? (
          <p className="max-w-xs text-center text-muted-foreground text-xs">
            An agent in this worktree opens its browser with <code>berthd browser open</code>. Its page shows here, live, while you watch.
          </p>
        ) : frame ? (
          <img alt="The agent's browser" src={`data:${frame.mime ?? "image/jpeg"};base64,${frame.data}`} className="max-h-full max-w-full rounded border bg-white object-contain shadow-sm" />
        ) : (
          <Spinner className="size-4" />
        )}
      </div>
    </div>
  );
}

// PickSender sends a picked element to the worktree's agent, with a note.
function PickSender({ pick, ctx, onDone }: { pick: Pick; ctx: BrowserContext; onDone(): void }) {
  const ref = ctx.ref!;
  const session = useStore((s) => s.boxes[ref.box]?.sessions?.find((x) => x.dir === ref.path && !x.exited && agentOf(x)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await sendPrompt(ref.box, session.name, pickMessage(pick, note), { when: "idle" });
      toastManager.add({ type: "success", title: "Sent to the agent", description: `${pick.role}${pick.name ? ` "${pick.name}"` : ""}` });
      onDone();
    } catch (err) {
      toastManager.add({ type: "error", title: "Couldn't send it", description: String(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="flex shrink-0 items-center gap-2 border-b bg-accent/40 px-2 py-1.5 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <CrosshairIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="max-w-56 shrink-0 truncate font-mono">
        {pick.role}
        {pick.name && ` "${pick.name}"`}
      </span>
      <input
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={session ? "What about it? (optional)" : "No agent runs in this worktree"}
        disabled={!session}
        className="h-6 min-w-0 flex-1 rounded border bg-background px-2 outline-none focus:border-ring"
      />
      <Button type="submit" size="xs" disabled={!session || busy}>
        <SendIcon />
        Send to agent
      </Button>
      <button type="button" aria-label="Cancel" className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={onDone}>
        <XIcon className="size-3.5" />
      </button>
    </form>
  );
}
