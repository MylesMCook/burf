import { ChevronDownIcon, ExternalLinkIcon, PlayIcon, RotateCwIcon, ScrollTextIcon, Settings2Icon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { openProjectSettings } from "@/components/skills/project-settings-dialog";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { boxApi, type WorktreeService } from "@/lib/api";
import { portUrl } from "@/lib/browser-url";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { currentSpace, openTab, splitPane, useWorkspaces, type WorktreeRef } from "@/lib/workspaces";
import { contribute } from "@/plugins/registry";

type Action = "start" | "stop" | "restart";

// useWorktreeServices is the current worktree's services, refetched when
// their events say something changed.
function useWorktreeServices(ref?: WorktreeRef) {
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
      setError(errorMessage(err));
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

const live = (s: WorktreeService) => s.state === "running" || s.state === "activating";

// RunMenu is the tab strip's Run button: the worktree's own services (dev
// servers, from its repository's .berth/config.json), each on the
// worktree's ports.
export function RunMenu() {
  const ref = useWorkspaces((s) => (s.current ? s.spaces[s.current]?.ref : undefined));
  const { services, error, reload, setServices } = useWorktreeServices(ref);
  const [busy, setBusy] = useState<string>();
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
  const besideFocus = (content: Parameters<typeof openTab>[0]) => {
    const key = useWorkspaces.getState().current;
    const ws = currentSpace();
    const tab = ws?.tabs.find((t) => t.id === ws.active);
    if (key && tab) splitPane(key, tab.id, tab.focus, "row", content);
    else openTab(content);
  };
  const openPage = (svc: WorktreeService) => {
    const url = urlFor(svc);
    if (url) besideFocus({ kind: "browser", url });
  };
  const viewLog = (svc: WorktreeService) => openTab({ kind: "log", box: ref.box, location: ref.location, worktree: ref.worktree, service: svc.name });

  const onPrimary = () => {
    if (!primary) return;
    if (running) openPage(primary);
    else void act(primary, "start");
  };

  return (
    <div className="flex h-6.5 items-stretch rounded-md text-xs">
      <button
        type="button"
        disabled={!primary || busy !== undefined}
        onClick={onPrimary}
        title={primary ? (running ? `Open ${primary.name}` : `Start ${primary.name}: ${primary.run}`) : "This repository defines no services"}
        className="flex items-center gap-1.5 rounded-l-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-45 disabled:hover:bg-transparent"
      >
        {busy ? <Spinner className="size-3" /> : running ? <span className="size-1.5 rounded-full bg-success" /> : <PlayIcon className="size-3" />}
        {running ? primary.name : "Run"}
      </button>
      <Menu
        onOpenChange={(open) => {
          if (open) void reload();
        }}
      >
        <MenuTrigger render={<button type="button" aria-label="Services" className="flex items-center rounded-r-md px-1 text-muted-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent" />}>
          <ChevronDownIcon className="size-3" />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-64">
          {services === undefined && (
            <div className="flex items-center gap-2 px-2 py-2 text-muted-foreground text-xs">
              <Spinner className="size-3" /> Loading services…
            </div>
          )}
          {services?.length === 0 && (
            <div className="max-w-64 px-2 py-2 text-muted-foreground text-xs">
              {error ?? `${ref.location} defines no services yet. Add a dev server so every worktree can run its own on its own ports.`}
            </div>
          )}
          {services?.map((svc, i) => (
            <MenuGroup key={svc.name}>
              {i > 0 && <MenuSeparator />}
              <MenuGroupLabel className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", live(svc) ? "bg-success" : svc.state === "failed" ? "bg-destructive" : "bg-muted-foreground/40")} />
                <span className="font-medium text-foreground">{svc.name}</span>
                <span className="truncate font-mono text-[10px]">{svc.state}{svc.port ? ` · :${svc.port}` : ""}</span>
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
              <MenuItem onClick={() => viewLog(svc)}>
                <ScrollTextIcon />
                View log
              </MenuItem>
              <MenuItem disabled={!urlFor(svc)} onClick={() => openPage(svc)}>
                <ExternalLinkIcon />
                Open in browser tab
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

