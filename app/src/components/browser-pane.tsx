import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeftIcon, ArrowUpRightIcon, ArrowRightIcon, BotIcon, CrosshairIcon, ExternalLinkIcon, GlobeIcon, RotateCwIcon, SendIcon, ShieldAlertIcon, XIcon } from "lucide-react";
import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";

import { BrowserSandboxCard, seedSandbox, useSandboxCardState } from "@/components/browser-sandbox";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { isTauri } from "@/lib/api";
import { agentBrowserStatus, boxHasBrowser, type Frame, watchAgentBrowser } from "@/lib/agent-browser";
import { agentOf } from "@/lib/derive";
import { send as sendPrompt } from "@/lib/orchestrate";
import { PICKER_SCRIPT, type Pick, parsePick, pickMessage } from "@/lib/picker";
import { toastManager } from "@/components/ui/toast";
import { berthUrlLabel, boxAliases, type BrowserContext, describeBerthUrl, hostSuffix, resolveBrowserInput, suggestions, worktreeHost } from "@/lib/browser-url";
import { openUrl } from "@/lib/open-url";
import { overlayOpen } from "@/lib/overlays";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { demoDevServer } from "@/demo/dev-server";
import { currentSpace, rememberUrl, useWorkspaces, useWorktreeRef } from "@/lib/workspaces";

interface Props {
  // The pane's id. Child webviews are keyed by it, so pass the pane's own id
  // to keep the page when the pane moves within the layout.
  id?: string;
  url: string;
  visible: boolean;
  onNavigate(url: string): void;
  // The worktree (workspace key) the pane belongs to, which a typed port
  // opens on; unset, the one showing.
  worktree?: string;
}

type Mode = "native" | "iframe";

// BrowserPane shows a web page in a pane, mostly a box's dev server through
// the laptop's proxy (a worktree's own name, like
// http://checkout.shop.devl.localhost:1377/). In the app it is a native child
// webview laid over the pane, so every page works as in a browser; in a plain
// browser, or when that fails, it is an iframe.
export function BrowserPane({ id: paneId, url, visible, onNavigate, worktree }: Props) {
  const fallbackId = useId();
  const id = useMemo(() => (paneId ?? fallbackId).replace(/[^A-Za-z0-9_-]/g, ""), [paneId, fallbackId]);
  const [mode, setMode] = useState<Mode>(isTauri() ? "native" : "iframe");
  const [failure, setFailure] = useState<string>();
  const [input, setInput] = useState(url);
  const [loading, setLoading] = useState(false);
  const ctx = useBrowserContext(worktree);
  // Select the stable list and derive from it: a selector that builds a new
  // array every time never lets the store settle.
  const boxes = useStore((s) => s.status?.boxes);
  // Each box's own name, as one string so the store can settle on it.
  const selves = useStore((s) => Object.entries(s.boxes).map(([name, b]) => `${name}=${b?.info?.name ?? ""}`).join(","));
  const where = useMemo(() => {
    if (!url) return undefined;
    const self = new Map(selves.split(",").map((kv) => kv.split("=") as [string, string]));
    return describeBerthUrl(url, (boxes ?? []).map((b) => b.name), boxAliases((boxes ?? []).map((b) => ({ name: b.name, self: self.get(b.name) }))));
  }, [url, boxes, selves]);

  // The iframe keeps its own history of addresses entered here; the native
  // webview has the page's real history.
  const [history, setHistory] = useState<string[]>(url ? [url] : []);
  const [at, setAt] = useState(url ? 0 : -1);
  const [nonce, setNonce] = useState(0);
  const native = useRef<NativeView>(null);
  const address = useRef<HTMLInputElement>(null);
  const selecting = useRef(false);

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

  // The pane is always your own browser, on this laptop, through its proxy.
  // While an agent drives its own browser on the box for this worktree, its
  // view can be watched here instead, live, and it says so.
  const agentLive = useAgentBrowserLive(ctx.ref, visible);
  const [watching, setWatching] = useState(false);
  const agentView = watching && !!agentLive?.running;
  // Where the agent's page is, from its frames as they come.
  const [agentAt, setAgentAt] = useState<string>();
  useEffect(() => {
    if (agentLive && !agentLive.running) setWatching(false);
  }, [agentLive]);
  // The agent's browser can't start on the box (Chromium's sandbox): a
  // marked chip, and a card in the agent's view with the ways out.
  const sandbox = useSandboxCardState(ctx.ref?.box ?? "");
  const sandboxBlocked = !agentLive?.running && (sandbox === "blocked" || sandbox === "fixing" || sandbox === "still-blocked");
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const sandboxView = sandboxOpen && sandbox !== "hidden" && !agentView && !!ctx.ref;
  useEffect(() => {
    if (sandbox === "hidden") setSandboxOpen(false);
  }, [sandbox]);
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
    <div data-testid="browser-pane" data-mode={mode} className="flex min-h-0 flex-1 flex-col bg-background">
      {sandboxView ? (
        <SandboxBar box={ctx.ref!.box} fixed={sandbox === "fixed" || sandbox === "no-sandbox"} onBack={() => setSandboxOpen(false)} />
      ) : agentView && ctx.ref ? (
        <AgentBar
          ctx={ctx}
          url={agentAt ?? agentLive?.url}
          onBack={() => setWatching(false)}
          onOpenHere={(u) => {
            setWatching(false);
            go(u);
          }}
        />
      ) : (
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
              onFocus={(e) => {
                e.target.select();
                selecting.current = true;
              }}
              // WebKit's mouseup after a click to focus undoes the select:
              // the first click selects the whole address, as browsers do.
              onMouseUp={(e) => {
                if (selecting.current) e.preventDefault();
                selecting.current = false;
              }}
              className="h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-xs outline-none"
            />
          </div>
          <ToolButton label="Pick an element for the agent" disabled={!url} onClick={pick}>
            <CrosshairIcon />
          </ToolButton>
          <ToolButton label="Open in your browser" disabled={!url} onClick={() => void openUrl(url)}>
            <ExternalLinkIcon />
          </ToolButton>
          {sandboxBlocked && ctx.ref && (
            <Tip label={`The agent's browser can't start on ${ctx.ref.box}. See why, and fix it.`}>
              <button
                type="button"
                onClick={() => setSandboxOpen(true)}
                className="ml-1 inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-md border border-warning/40 bg-warning/8 px-2 text-[11px] text-warning-foreground hover:bg-warning/16"
              >
                <ShieldAlertIcon className="size-3" />
                Agent's browser blocked
              </button>
            </Tip>
          )}
          {agentLive?.running && (
            <Tip label="An agent is using its own browser on the box for this worktree. Watch it here.">
              <button
                type="button"
                onClick={() => setWatching(true)}
                className="ml-1 inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <LiveDot />
                Agent's view · live
              </button>
            </Tip>
          )}
        </form>
      )}
      {picked && ctx.ref && <PickSender pick={picked} ctx={ctx} onDone={() => setPicked(undefined)} />}
      {failure && mode === "iframe" && <p className="shrink-0 border-b bg-muted/40 px-3 py-1 text-muted-foreground text-xs">The built-in browser could not open ({failure}); showing the page in a frame instead.</p>}
      {/* Watching the agent keeps your page as it was, hidden underneath. */}
      {agentView && ctx.ref && <AgentView ctx={ctx} visible={visible} onUrl={setAgentAt} />}
      {sandboxView && (
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto bg-muted/30 p-6 pt-12">
          <BrowserSandboxCard box={ctx.ref!.box} worktree={ctx.ref} className="w-full max-w-2xl bg-background shadow-xs" />
        </div>
      )}
      {!url ? (
        !agentView && !sandboxView && <Suggestions ctx={ctx} onPick={go} />
      ) : mode === "native" ? (
        <NativeSurface
          ref={native}
          id={id}
          url={url}
          visible={visible && !agentView && !sandboxView}
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
        <div className={cn("flex min-h-0 flex-1 flex-col", (agentView || sandboxView) && "hidden")}>
          <FramedPage key={`${url}#${nonce}`} id={id} url={url} onReload={reload} />
        </div>
      )}
    </div>
  );
}

// useBrowserContext gathers what resolving a typed port needs: the pane's
// worktree (else the one showing), its box's services, and the proxy's URL
// port.
function useBrowserContext(worktree?: string): BrowserContext {
  const own = useWorktreeRef(worktree);
  const ref = own ?? currentSpace()?.ref;
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
    <div ref={surface} className={cn("relative min-h-0 flex-1 bg-white", !visible && "hidden")}>
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

// Suggestions offers the pane's worktree's dev servers, by the names the
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

export interface AgentLive {
  running: boolean;
  url?: string;
}

// useAgentBrowserLive is whether an agent's browser runs on the box for the
// pane's worktree, checked while the pane is on screen (undefined until
// known, and always for a box without one).
function useAgentBrowserLive(ref: BrowserContext["ref"], visible: boolean): AgentLive | undefined {
  const box = ref?.box;
  const location = ref?.location;
  const worktree = ref?.worktree;
  const capable = !!box && boxHasBrowser(box);
  const [live, setLive] = useState<AgentLive>();
  useEffect(() => {
    setLive(undefined);
    if (!capable || !visible || !box || !location || !worktree) return;
    let on = true;
    const tick = () =>
      agentBrowserStatus(box, location, worktree).then(
        (s) => {
          if (!on) return;
          seedSandbox(box, s.health);
          setLive((was) => (was?.running === s.running && was?.url === s.status?.url ? was : { running: s.running, url: s.status?.url }));
        },
        () => on && setLive({ running: false }),
      );
    void tick();
    const t = window.setInterval(tick, 5000);
    return () => {
      on = false;
      window.clearInterval(t);
    };
  }, [capable, visible, box, location, worktree]);
  return live;
}

function LiveDot() {
  return (
    <span className="relative flex size-1.5 shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70" />
      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
    </span>
  );
}

// AgentBar stands in for the address bar while you watch the agent's
// browser: it is plainly not yours, and nothing in it drives the agent's.
function AgentBar({ ctx, url, onBack, onOpenHere }: { ctx: BrowserContext; url?: string; onBack(): void; onOpenHere(url: string): void }) {
  const here = url ? humanUrl(url, ctx) : undefined;
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-emerald-500/[0.06] px-2 text-xs">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-1 font-medium text-[11px] text-emerald-700 dark:text-emerald-300">
        <BotIcon className="size-3" />
        Agent's view · live
        <LiveDot />
      </span>
      <Tip label={<span className="break-all font-mono">{url ?? ""}</span>} className="max-w-md">
        <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{here ?? "…"}</span>
      </Tip>
      {here && (
        <Button size="xs" variant="ghost" className="shrink-0" onClick={() => onOpenHere(here)}>
          Open in your view
        </Button>
      )}
      <Button size="xs" variant="outline" className="shrink-0" onClick={onBack}>
        <XIcon />
        Your view
      </Button>
    </div>
  );
}

// SandboxBar stands in for the address bar while the pane shows why the
// agent's browser can't start.
function SandboxBar({ box, fixed, onBack }: { box: string; fixed: boolean; onBack(): void }) {
  return (
    <div className={cn("flex h-9 shrink-0 items-center gap-2 border-b px-2 text-xs", fixed ? "bg-success/[0.06]" : "bg-warning/[0.06]")}>
      <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium text-[11px]", fixed ? "bg-success/15 text-success-foreground" : "bg-warning/15 text-warning-foreground")}>
        <BotIcon className="size-3" />
        {fixed ? "Agent's browser" : "Agent's browser · blocked"}
      </span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">on {box}</span>
      <Button size="xs" variant="outline" className="shrink-0" onClick={onBack}>
        <XIcon />
        Your view
      </Button>
    </div>
  );
}

// AgentView shows the agent's browser on the box, live: frames stream only
// while this view is on screen. It only watches; the agent drives.
function AgentView({ ctx, visible, onUrl }: { ctx: BrowserContext; visible: boolean; onUrl(url?: string): void }) {
  const ref = ctx.ref!;
  const [frame, setFrame] = useState<Frame>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!visible) return;
    const ac = new AbortController();
    setError(undefined);
    const show = (f: Frame) => {
      setFrame(f);
      if (f.url) onUrl(f.url);
    };
    watchAgentBrowser(ref.box, ref.location, ref.worktree, show, ac.signal).catch((e) => {
      if (!ac.signal.aborted) setError(String(e));
    });
    return () => {
      ac.abort();
      onUrl(undefined);
    };
    // onUrl is the pane's state setter, the same every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ref.box, ref.location, ref.worktree]);
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/30 p-3">
      {frame ? (
        <img alt="The agent's browser" src={`data:${frame.mime ?? "image/jpeg"};base64,${frame.data}`} className="max-h-full max-w-full rounded border bg-white object-contain shadow-sm" />
      ) : error ? (
        <p className="max-w-xs text-center text-muted-foreground text-xs">{error}</p>
      ) : (
        <Spinner className="size-4" />
      )}
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
