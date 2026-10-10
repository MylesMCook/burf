import * as stylex from "@stylexjs/stylex";
import { CableIcon, ChevronRightIcon, CopyIcon, DatabaseIcon, GlobeIcon, MonitorIcon, MonitorSmartphoneIcon, PlayIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useWorktreeServices } from "@/components/workspace/run-menu";
import { ServiceIcon, serviceRunning, showServiceTerminal } from "@/components/workspace/service-terminal";
import { boxApi, type WorktreeService } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { toastManager } from "@/components/ui/toast";
import { openBrowserAt, openPreviewAt } from "@/lib/actions";
import { hostSuffix, worktreeHost } from "@/lib/browser-url";
import { copyText } from "@/lib/clipboard";
import { NONE, useStore } from "@/lib/store";
import { type LiveService, liveServices } from "@/lib/worktree-services";
import type { WorktreeRef } from "@/lib/workspaces";
import { PluginBoundary, pluginContexts } from "@/plugins/plugin-boundary";
import { useRegistry } from "@/plugins/registry";
import { useTitleAt } from "@/lib/worktree-names";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "24px",
  },
  s1: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
  },
  s2: {
    "fontFamily": "var(--font-mono)",
  },
  s3: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s4: {
    "flexShrink": 0,
  },
  s5: {
    "marginBottom": "4px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "minWidth": "0px",
  },
  s7: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s8: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s9: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s10: {
    "marginTop": "4px",
  },
  s11: {
    "display": "flex",
    "height": "28px",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s12: {
    "width": "14px",
    "height": "14px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s13: {
    "transform": "rotate(90deg)",
  },
  s14: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s15: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s16: {
    "display": "flex",
    "height": "40px",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s17: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s18: {
    "width": "16px",
    "height": "16px",
  },
  s19: {
    "display": "flex",
    "minWidth": "0px",
    "maxWidth": "45%",
    "flexShrink": 0,
    "alignItems": "baseline",
    "gap": "6px",
  },
  s20: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s21: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s22: {
    "display": "block",
    "wordBreak": "break-all",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s23: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s24: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s25: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s26: {
    "color": "var(--muted-foreground)",
  },
  s27: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s28: {
    "backgroundColor": "var(--success)",
  },
  s29: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
  s30: {
    "width": "24px",
    "height": "24px",
    "flexShrink": 0,
  },
  s31: {
    "flexShrink": 0,
  },
  s32: {
    "flexShrink": 0,
  },
  s33: {
    "display": "flex",
    "height": "40px",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s34: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "color": "var(--muted-foreground)",
  },
  s35: {
    "width": "16px",
    "height": "16px",
  },
  s36: {
    "display": "block",
    "wordBreak": "break-all",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s37: {
    "display": "flex",
    "minWidth": "0px",
    "maxWidth": "45%",
    "flexShrink": 0,
    "alignItems": "baseline",
    "gap": "6px",
  },
  s38: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s39: {
    "fontWeight": 400,
    "color": "var(--muted-foreground)",
  },
  s40: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s41: {
    "wordBreak": "break-all",
    "fontFamily": "var(--font-mono)",
  },
  s42: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s43: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--accent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s44: {
    "flexShrink": 0,
  },
  s45: {
    "flexShrink": 0,
  },
  s46: {
    "flexShrink": 0,
  },
  s47: {
    "visibility": "hidden",
    "flexShrink": 0,
  },

  s48: {
    maxWidth: "24rem",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// WorktreeSections sit under the composer wherever work starts in a
// worktree (its launcher, and a new agent's first prompt): what runs there,
// each with its private URL to open in a tab or copy, then what plugins add
// with berth.addWorktreeSection.
export function WorktreeSections({ worktree: ref, className }: { worktree: WorktreeRef; className?: string }) {
  const sections = useRegistry((s) => s.worktreeSections);
  return (
    <div className={[sx(paint.s0), className].filter(Boolean).join(" ")}>
      <LiveServices worktree={ref} />
      {sections.map(({ plugin, item }) => {
        const ctx = pluginContexts.get(plugin);
        if (!ctx) return null;
        const { Component } = item;
        return (
          <section key={`${plugin}:${item.id}`} aria-label={item.title}>
            {item.title && <Heading>{item.title}</Heading>}
            <PluginBoundary plugin={plugin}>
              <Component berth={ctx} box={ref.box} location={ref.location} worktree={ref.worktree} path={ref.path} main={ref.main} />
            </PluginBoundary>
          </section>
        );
      })}
    </div>
  );
}

// SessionWorktreeSections is WorktreeSections for the worktree a session
// runs in.
export function SessionWorktreeSections({ box, session, className }: { box: string; session: string; className?: string }) {
  const dir = useStore((s) => s.boxes[box]?.sessions?.find((x) => x.name === session)?.dir);
  const locations = useStore((s) => s.boxes[box]?.locations);
  const ref = useMemo<WorktreeRef | undefined>(() => {
    for (const l of locations ?? []) {
      const w = l.worktrees?.find((x) => x.path === dir);
      if (w) return { box, location: l.name, worktree: w.name, path: w.path, main: w.main };
    }
    return undefined;
  }, [box, dir, locations]);
  return ref ? <WorktreeSections worktree={ref} className={className} /> : null;
}

function PrivateUrl({ url }: { url: string }) {
  return (
    <div className={sx(paint.s1)}>
      <Tip label={<span className={sx(paint.s2)}>{url}</span>}>
        <code className={sx(paint.s3)}>{url}</code>
      </Tip>
      <Tip label="Copy URL">
        <span className={sx(paint.s4)}><Button size="icon-xs" variant="ghost" aria-label="Copy URL"  onClick={() => void copyText(url, "Copied the URL")} muted>
          <CopyIcon />
        </Button></span>
      </Tip>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className={sx(paint.s5)}>{children}</h2>;
}

const ICONS = { dev: MonitorIcon, web: GlobeIcon, data: DatabaseIcon, other: CableIcon };

// LiveServices is what listens in the worktree: what opens in a tab and its
// data stores, then helpers (an agent's headless Chrome, a language server)
// folded away under "Other ports". With nothing yet, it says where the dev
// server's page will be.
function LiveServices({ worktree: ref }: { worktree: WorktreeRef }) {
  const services = useStore((s) => s.boxes[ref.box]?.services ?? NONE);
  const urlPort = useStore((s) => s.status?.proxy.url_port);
  const devPort = useStore((s) => s.boxes[ref.box]?.locations?.find((l) => l.name === ref.location)?.worktrees?.find((w) => w.path === ref.path)?.port);
  const own = useWorktreeServices(ref);
  const sessions = useStore((s) => s.boxes[ref.box]?.sessions);
  // What listens on the worktree's own port is its running service when the
  // box can't name the process (macOS often can't).
  const ownRun = own.services?.find((svc) => serviceRunning(svc, sessions))?.run;
  const named = useMemo(() => (ownRun ? services.map((s) => (!s.process && s.path === ref.path && s.port === devPort ? { ...s, process: ownRun } : s)) : services), [services, ownRun, ref.path, devPort]);
  const rows = useMemo(() => liveServices(named, { ref, services: named, urlPort }, devPort), [named, ref, urlPort, devPort]);
  const [showOther, setShowOther] = useState(false);
  const name = useTitleAt(ref.box, ref.path) ?? (ref.main ? ref.location : ref.worktree);
  const host = worktreeHost(ref);
  const main = rows.filter((r) => r.kind !== "other");
  const other = rows.filter((r) => r.kind === "other");

  return (
    <section aria-label={`Running in ${name}`} className={sx(paint.s6)}>
      <Heading>Running in {name}</Heading>
      <TerminalServices worktree={ref} own={own} />
      {main.length ? (
        <ul className={sx(paint.s7)}>
          {main.map((r) => (
            <ServiceRow key={r.port} row={r} />
          ))}
        </ul>
      ) : (
        <>
          <p className={sx(paint.s8)}>
            Nothing to open yet.{" "}
            {devPort ? (
              <>
                A dev server on <code className={sx(paint.s9)}>$BERTH_PORT</code> ({devPort}) opens at {host ? "this address" : "its private URL"}.
              </>
            ) : (
              "Start a dev server here and its private URL shows up."
            )}
          </p>
          {devPort && host && <PrivateUrl url={`http://${host}${hostSuffix(urlPort)}/`} />}
        </>
      )}
      {other.length > 0 && (
        <div className={sx(paint.s10)}>
          <button
            type="button"
            aria-expanded={showOther}
            onClick={() => setShowOther(!showOther)}
            className={sx(paint.s11)}
          >
            <ChevronRightIcon className={[sx(paint.s12), showOther && sx(paint.s13)].filter(Boolean).join(" ")} />
            Other ports ({other.length})
          </button>
          {showOther && (
            <ul className={sx(paint.s14)}>
              {other.map((r) => (
                <ServiceRow key={r.port} row={r} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// TerminalServices are the worktree's services that run in a terminal of
// their own: each with its state, Start when it is stopped, and its tab.
function TerminalServices({ worktree: ref, own: { services, reload } }: { worktree: WorktreeRef; own: ReturnType<typeof useWorktreeServices> }) {
  const sessions = useStore((s) => s.boxes[ref.box]?.sessions);
  const [busy, setBusy] = useState<string>();
  const rows = (services ?? []).filter((s) => s.terminal && s.session);
  if (!rows.length) return null;
  const start = async (svc: WorktreeService) => {
    const client = useStore.getState().client;
    if (!client) return;
    setBusy(svc.name);
    try {
      await boxApi.serviceAction(client, ref.box, ref.location, ref.worktree, svc.name, "start");
      await useStore.getState().refreshBox(ref.box, ["sessions"]);
    } catch (err) {
      toastManager.add({ title: `Could not start ${svc.name}`, description: errorMessage(err), type: "error" });
    } finally {
      setBusy(undefined);
      void reload();
    }
  };
  return (
    <ul className={sx(paint.s15)}>
      {rows.map((svc) => {
        const running = serviceRunning(svc, sessions);
        return (
          <li key={svc.name} className={sx(paint.s16)}>
            <span className={sx(paint.s17)}>
              <ServiceIcon className={sx(paint.s18)} />
            </span>
            <span className={sx(paint.s19)}>
              <span className={sx(paint.s20)}>{svc.title || svc.name}</span>
              {svc.title && svc.title !== svc.name && <span className={sx(paint.s21)}>{svc.name}</span>}
            </span>
            <Tip label={<span className={[sx(paint.s22), sx(paint.s48)].filter(Boolean).join(" ")}>{svc.run}</span>}>
              <span className={sx(paint.s23)}>{svc.run}</span>
            </Tip>
            <span className={[sx(paint.s24), running ? sx(paint.s25) : sx(paint.s26)].filter(Boolean).join(" ")}>
              <span className={[sx(paint.s27), running ? sx(paint.s28) : sx(paint.s29)].filter(Boolean).join(" ")} />
              {running ? "Running" : "Stopped"}
            </span>
            {running ? (
              <span aria-hidden className={sx(paint.s30)} />
            ) : (
              <Tip label={`Start ${svc.title || svc.name}`}>
                <span className={sx(paint.s31)}><Button size="icon-xs" variant="ghost" aria-label={`Start ${svc.title || svc.name}`} disabled={busy === svc.name}  onClick={() => void start(svc)} muted>
                  {busy === svc.name ? <Spinner  size="sm"/> : <PlayIcon />}
                </Button></span>
              </Tip>
            )}
            <span className={sx(paint.s32)}><Button size="xs" variant="outline"  onClick={() => void showServiceTerminal(ref, svc)}>
              Show terminal
            </Button></span>
          </li>
        );
      })}
    </ul>
  );
}

function ServiceRow({ row: r }: { row: LiveService }) {
  const Icon = ICONS[r.kind];
  const web = r.kind === "dev" || r.kind === "web";
  const address = web ? r.url : `localhost:${r.port}`;
  return (
    <li className={sx(paint.s33)}>
      <span className={sx(paint.s34)}>
        <Icon className={sx(paint.s35)} />
      </span>
      <Tip label={r.command ? <span className={[sx(paint.s36), sx(paint.s48)].filter(Boolean).join(" ")}>{r.command}</span> : undefined}>
        <span className={sx(paint.s37)}>
          <span className={[sx(paint.s38), r.kind === "other" && sx(paint.s39)].filter(Boolean).join(" ")}>{r.label}</span>
          {r.detail && <span className={sx(paint.s40)}>{r.detail}</span>}
        </span>
      </Tip>
      <Tip label={<span className={sx(paint.s41)}>{r.url}</span>}>
        <span className={sx(paint.s42)}>{r.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
      </Tip>
      <span className={sx(paint.s43)}>:{r.port}</span>
      <Tip label={web ? "Copy URL" : "Copy address"}>
        <span className={sx(paint.s44)}><Button size="icon-xs" variant="ghost" aria-label={`Copy ${r.label}'s ${web ? "URL" : "address"}`}  onClick={() => void copyText(address, web ? "Copied the URL" : "Copied the address")} muted>
          <CopyIcon />
        </Button></span>
      </Tip>
      {web && (
        <Tip label="This page at every size: phones, tablet and Tailwind's breakpoints">
          <span className={sx(paint.s45)}><Button size="xs" variant="ghost"  onClick={() => openPreviewAt(r.url)} muted>
            <MonitorSmartphoneIcon />
            Preview
          </Button></span>
        </Tip>
      )}
      {web ? (
        <span className={sx(paint.s46)}><Button size="xs" variant="outline"  onClick={() => openBrowserAt(r.url)}>
          Open in tab
        </Button></span>
      ) : (
        // Keeps the rows' buttons in one column.
        <span className={sx(paint.s47)}><Button aria-hidden tabIndex={-1} size="xs" variant="outline">
          Open in tab
        </Button></span>
      )}
    </li>
  );
}
