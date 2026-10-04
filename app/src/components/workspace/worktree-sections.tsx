import { CableIcon, ChevronRightIcon, CopyIcon, DatabaseIcon, GlobeIcon, MonitorIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { openBrowserAt } from "@/lib/actions";
import { hostSuffix, worktreeHost } from "@/lib/browser-url";
import { copyText } from "@/lib/clipboard";
import { NONE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { type LiveService, liveServices } from "@/lib/worktree-services";
import type { WorktreeRef } from "@/lib/workspaces";
import { PluginBoundary, pluginContexts } from "@/plugins/plugin-boundary";
import { useRegistry } from "@/plugins/registry";

// WorktreeSections sit under the composer wherever work starts in a
// worktree (its launcher, and a new agent's first prompt): what runs there,
// each with its private URL to open in a tab or copy, then what plugins add
// with berth.addWorktreeSection.
export function WorktreeSections({ worktree: ref, className }: { worktree: WorktreeRef; className?: string }) {
  const sections = useRegistry((s) => s.worktreeSections);
  return (
    <div className={cn("flex flex-col gap-6", className)}>
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

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-1 px-2 font-medium text-muted-foreground text-xs">{children}</h2>;
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
  const rows = useMemo(() => liveServices(services, { ref, services, urlPort }, devPort), [services, ref, urlPort, devPort]);
  const [showOther, setShowOther] = useState(false);
  const name = ref.main ? ref.location : ref.worktree;
  const host = worktreeHost(ref);
  const main = rows.filter((r) => r.kind !== "other");
  const other = rows.filter((r) => r.kind === "other");

  return (
    <section aria-label={`Running in ${name}`} className="min-w-0">
      <Heading>Running in {name}</Heading>
      {main.length ? (
        <ul className="flex min-w-0 flex-col">
          {main.map((r) => (
            <ServiceRow key={r.port} row={r} />
          ))}
        </ul>
      ) : (
        <p className="px-2 text-muted-foreground text-xs leading-relaxed">
          Nothing to open yet.{" "}
          {devPort ? (
            <>
              A dev server on <code className="font-mono text-[11px] text-foreground/80">$BERTH_PORT</code> ({devPort}) opens at{" "}
              {host ? <code className="break-all font-mono text-[11px] text-foreground/80">{`http://${host}${hostSuffix(urlPort)}/`}</code> : "its private URL"}.
            </>
          ) : (
            "Start a dev server here and its private URL shows up."
          )}
        </p>
      )}
      {other.length > 0 && (
        <div className="mt-1">
          <button
            type="button"
            aria-expanded={showOther}
            onClick={() => setShowOther(!showOther)}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRightIcon className={cn("size-3.5 transition-transform", showOther && "rotate-90")} />
            Other ports ({other.length})
          </button>
          {showOther && (
            <ul className="flex min-w-0 flex-col">
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

function ServiceRow({ row: r }: { row: LiveService }) {
  const Icon = ICONS[r.kind];
  const web = r.kind === "dev" || r.kind === "web";
  const address = web ? r.url : `localhost:${r.port}`;
  return (
    <li className="flex h-10 min-w-0 items-center gap-3 rounded-md px-2 text-sm hover:bg-accent/60">
      <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <Tip label={r.command ? <span className="block max-w-sm break-all font-mono text-[11px]">{r.command}</span> : undefined}>
        <span className="flex min-w-0 max-w-[45%] shrink-0 items-baseline gap-1.5">
          <span className={cn("truncate font-medium", r.kind === "other" && "font-normal text-muted-foreground")}>{r.label}</span>
          {r.detail && <span className="truncate text-muted-foreground text-xs">{r.detail}</span>}
        </span>
      </Tip>
      <Tip label={<span className="break-all font-mono">{r.url}</span>}>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{r.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
      </Tip>
      <span className="shrink-0 rounded bg-accent px-1.5 py-px font-mono text-[11px] text-muted-foreground tabular-nums">:{r.port}</span>
      <Tip label={web ? "Copy URL" : "Copy address"}>
        <Button size="icon-xs" variant="ghost" aria-label={`Copy ${r.label}'s ${web ? "URL" : "address"}`} className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => void copyText(address, web ? "Copied the URL" : "Copied the address")}>
          <CopyIcon />
        </Button>
      </Tip>
      {web ? (
        <Button size="xs" variant="outline" className="shrink-0" onClick={() => openBrowserAt(r.url)}>
          Open in tab
        </Button>
      ) : (
        // Keeps the rows' buttons in one column.
        <span aria-hidden className="w-[78px] shrink-0" />
      )}
    </li>
  );
}
