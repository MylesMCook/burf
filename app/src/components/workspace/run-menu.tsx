import * as stylex from "@stylexjs/stylex";
import { ChevronDownIcon, ExternalLinkIcon, MonitorSmartphoneIcon, PlayIcon, RotateCwIcon, ScrollTextIcon, Settings2Icon, SquareIcon, SquareTerminalIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Tip } from "@/components/tip";
import { openProjectSettings } from "@/components/skills/project-settings-dialog";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { serviceRunning, showServiceTerminal } from "@/components/workspace/service-terminal";
import { toastManager } from "@/components/ui/toast";
import { boxApi, type WorktreeService } from "@/lib/api";
import { portUrl } from "@/lib/browser-url";
import { errorMessage } from "@/lib/format";
import { plainError } from "@/lib/errors";
import { useStore } from "@/lib/store";
import { focusedPane, openFor, useHereRef, type WorktreeRef } from "@/lib/workspaces";
import { contribute } from "@/plugins/registry";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "26px",
    "alignItems": "stretch",
    "borderRadius": "var(--radius-md)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "borderTopLeftRadius": "var(--radius-md)",
    "borderBottomLeftRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s2: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--success)",
  },
  s3: {
    "width": "12px",
    "height": "12px",
  },
  s4: {
    "display": "flex",
    "minWidth": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderTopRightRadius": "var(--radius-md)",
    "borderBottomRightRadius": "var(--radius-md)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s5: {
    "width": "12px",
    "height": "12px",
  },
  s6: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "maxWidth": "256px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s9: {
    "backgroundColor": "var(--success)",
  },
  s10: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
  },
  n0: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  n1: {
    "backgroundColor": "var(--success)",
  },
  n2: {
    "backgroundColor": "var(--destructive)",
  },
  n3: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },

  s12: {
    opacity: { "[aria-disabled=\"true\"]": 0.45 },
    backgroundColor: { "[aria-disabled=\"true\"]:hover": "transparent" },
  },
  s13: {
    backgroundColor: { "[data-popup-open]": color.accent },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type Action = "start" | "stop" | "restart";

// useWorktreeServices is a worktree's services, refetched when their events
// say something changed.
export function useWorktreeServices(ref?: WorktreeRef) {
  const client = useStore((s) => s.client);
  const [services, setServices] = useState<WorktreeService[]>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    if (!client || !ref) return;
    try {
      setServices(await boxApi.worktreeServices(client, ref.box, ref.location, ref.worktree));
      setError(undefined);
    } catch (err) {
      setServices([]);
      setError(plainError(err));
    }
  }, [client, ref?.box, ref?.location, ref?.worktree]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setServices(undefined);
    void load();
    if (!ref) return;
    return contribute("handlers", {
      plugin: "app",
      item: {
        type: "service.*",
        handler: (e) => {
          if (e.box === ref.box && e.data?.path === ref.path) void load();
        },
      },
    });
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  return { services, error, reload: load, setServices };
}


// RunMenu is the tab strip's Run button: the services (dev servers, from
// its repository's .berth/config.json) of the worktree you are acting in,
// the focused pane's, each on that worktree's ports.
export function RunMenu() {
  const ref = useHereRef();
  const { services, error, reload, setServices } = useWorktreeServices(ref);
  const [busy, setBusy] = useState<string>();
  // A service in a terminal is as its session says: Ctrl-C there stops it.
  const sessions = useStore((s) => (ref ? s.boxes[ref.box]?.sessions : undefined));
  // Nothing runs on a box that is away; the button says so.
  const away = useStore((s) => !!ref && !!s.status && s.status.boxes.find((b) => b.name === ref.box)?.state !== "online");
  const live = (svc: WorktreeService) => serviceRunning(svc, sessions);
  if (!ref) return null;

  const primary = services?.find((s) => s.autostart) ?? services?.[0];
  const running = primary && live(primary);

  const act = async (svc: WorktreeService, action: Action) => {
    const client = useStore.getState().client;
    if (!client) return;
    setBusy(svc.name);
    try {
      const next = await boxApi.serviceAction(client, ref.box, ref.location, ref.worktree, svc.name, action);
      setServices((list) => list?.map((s) => (s.name === svc.name ? { ...s, ...next } : s)));
    } catch (err) {
      toastManager.add({ title: `Could not ${action} ${svc.name}`, description: errorMessage(err), type: "error" });
      void reload();
    } finally {
      setBusy(undefined);
    }
  };

  const urlFor = (svc: WorktreeService) => {
    const st = useStore.getState();
    const services = st.boxes[ref.box]?.services ?? [];
    const port = svc.port ?? services.filter((s) => s.path === ref.path).map((s) => s.port).sort((a, b) => a - b)[0];
    return port ? portUrl(port, { ref, services, urlPort: st.status?.proxy.url_port }) : undefined;
  };

  // Beside the focused pane, so the terminal and its page sit together.
  const openPage = (svc: WorktreeService) => {
    const url = urlFor(svc);
    if (url) openFor({ kind: "browser", url }, { split: focusedPane() ? "row" : undefined });
  };
  const openPreview = (svc: WorktreeService) => {
    const url = urlFor(svc);
    if (url) openFor({ kind: "preview", url });
  };
  const viewLog = (svc: WorktreeService) => openFor({ kind: "log", box: ref.box, location: ref.location, worktree: ref.worktree, service: svc.name });

  const onPrimary = () => {
    if (!primary) return;
    if (running) openPage(primary);
    else void act(primary, "start");
  };

  return (
    <div className={sx(paint.s0)}>
      <Tip label={away ? `${ref.box} is offline, so nothing can start there` : primary ? (running ? `Open ${primary.name}` : `Start ${primary.name}: ${primary.run}`) : "This repository defines no services"} side="bottom">
        <button
          type="button"
          // Not disabled when there is nothing to run, so the tooltip can say why.
          aria-disabled={!primary || busy !== undefined || away}
          onClick={() => primary && busy === undefined && !away && onPrimary()}
          className={[sx(paint.s1), sx(paint.s12)].filter(Boolean).join(" ")}
        >
          {busy ? <Spinner  size="sm"/> : running ? <span className={sx(paint.s2)} /> : <PlayIcon className={sx(paint.s3)} />}
          {running ? primary.name : "Run"}
        </button>
      </Tip>
      <Menu
        onOpenChange={(open) => {
          if (open) void reload();
        }}
      >
        <MenuTrigger render={<button type="button" aria-label="Services" className={[sx(paint.s4), sx(paint.s13)].filter(Boolean).join(" ")} />}>
          <ChevronDownIcon className={sx(paint.s5)} />
        </MenuTrigger>
        <MenuPopup align="end" width={menuWidths.w64}>
          {services === undefined && (
            <div className={sx(paint.s6)}>
              <Spinner  size="sm"/> Loading services…
            </div>
          )}
          {services?.length === 0 && (
            <div className={sx(paint.s7)}>
              {error ?? `${ref.location} defines no services yet. Add a dev server so every worktree can run its own on its own ports.`}
            </div>
          )}
          {services?.map((svc, i) => (
            <MenuGroup key={svc.name}>
              {i > 0 && <MenuSeparator />}
              <MenuGroupLabel>
                <span className={[sx(paint.n0), live(svc) ? sx(paint.n1) : svc.state === "failed" ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")} />
                <span className={sx(paint.s10)}>{svc.name}</span>
                <span className={sx(paint.s11)}>{svc.terminal ? (live(svc) ? "running" : "stopped") : svc.state}{svc.port ? ` · :${svc.port}` : ""}</span>
              </MenuGroupLabel>
              {live(svc) ? (
                <>
                  <MenuItem onClick={() => void act(svc, "stop")}>
                    <SquareIcon />
                    Stop
                  </MenuItem>
                  <MenuItem onClick={() => void act(svc, "restart")}>
                    <RotateCwIcon />
                    Restart
                  </MenuItem>
                </>
              ) : (
                <MenuItem onClick={() => void act(svc, "start")}>
                  <PlayIcon />
                  Start
                </MenuItem>
              )}
              {svc.terminal && svc.session && (
                <MenuItem onClick={() => void showServiceTerminal(ref, svc)}>
                  <SquareTerminalIcon />
                  Show terminal
                </MenuItem>
              )}
              <MenuItem onClick={() => viewLog(svc)}>
                <ScrollTextIcon />
                View log
              </MenuItem>
              <MenuItem disabled={!urlFor(svc)} onClick={() => openPage(svc)}>
                <ExternalLinkIcon />
                Open in browser tab
              </MenuItem>
              <MenuItem disabled={!urlFor(svc)} onClick={() => openPreview(svc)}>
                <MonitorSmartphoneIcon />
                Preview sizes
              </MenuItem>
            </MenuGroup>
          ))}
          <MenuSeparator />
          <MenuItem onClick={() => openProjectSettings(ref.box, ref.location)}>
            <Settings2Icon />
            Project settings…
          </MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}

