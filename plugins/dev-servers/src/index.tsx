import * as stylex from "@stylexjs/stylex";
import { definePlugin, useBoxes, useCurrentWorktree, useEvent, type BerthPluginContext, type Location, type ScreenProps, type Service, type WorktreeService } from "@berth/plugin";
import {
  Badge,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
  Icon,
  Input,
  Skeleton,
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
  ViewHeader,
} from "@berth/plugin/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s1: {
    "width": "12px",
    "height": "12px",
  },
  s2: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "16px",
    },
  },
  s3: {
    "width": "224px",
  },
  s4: {
    "width": "14px",
    "height": "14px",
  },
  s5: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s6: {
    "height": "96px",
    "width": "100%",
  },
  s7: {
    "height": "96px",
    "width": "100%",
  },
  s8: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "marginBottom": "8px",
    "width": "20px",
    "height": "20px",
    "color": "var(--muted-foreground)",
  },
  s9: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s12: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s13: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "backgroundColor": "var(--success)",
  },
  s14: {
    "width": "56px",
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontVariantNumeric": "tabular-nums",
  },
  s15: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s16: {
    "marginRight": "8px",
    "fontWeight": 500,
  },
  s17: {
    "color": "var(--muted-foreground)",
  },
  s18: {
    "marginLeft": "8px",
    "fontFamily": "var(--font-mono)",
    "color": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s19: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "width": "14px",
    "height": "14px",
  },
  s21: {
    "width": "14px",
    "height": "14px",
  },
  s22: {
    "minWidth": "208px",
  },
  s23: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s24: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s25: {
    "backgroundColor": "var(--warning)",
  },
  s26: {
    "width": "56px",
    "flexShrink": 0,
    "fontWeight": 500,
  },
  s27: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s28: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  n0: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  n1: {
    "backgroundColor": "var(--warning)",
  },
  n2: {
    "backgroundColor": "var(--destructive)",
  },
  n3: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Dev servers: everything listening in a worktree, on every box, next to
// the services each repository declares for its worktrees. Open one in a
// browser tab beside your terminal, copy its private URL, or start and stop
// a repository's services.

export default definePlugin((berth) => {
  berth.addScreen({ id: "servers", title: "Dev servers", Component: ServersScreen });
  berth.addSidebarItem({ id: "servers", title: "Dev servers", icon: "Radio", screen: "servers" });
  berth.addStatusBarItem({ id: "servers", Component: ServersStatus });
  berth.addCommand({ id: "servers", title: "Show dev servers", group: "Dev servers", run: () => berth.openScreen("servers") });
});

interface Listening extends Service {
  box: string;
  url: string;
}

interface Configured extends WorktreeService {
  box: string;
  location: string;
  worktree: string;
}

interface Group {
  key: string;
  box: string;
  location: string;
  worktree: string;
  main?: boolean;
  listening: Listening[];
  configured: Configured[];
}

// useServers polls the listening servers of every online box, and reads the
// repositories' declared services when worktrees or services change.
function useServers(berth: BerthPluginContext) {
  const boxes = useBoxes();
  const online = useMemo(() => boxes.filter((b) => b.state === "online").map((b) => b.name), [boxes]);
  const key = online.join(",");
  const [listening, setListening] = useState<Listening[]>();
  const [configured, setConfigured] = useState<Configured[]>([]);
  const [stamp, setStamp] = useState(0);
  const reload = useCallback(() => setStamp((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const all = await Promise.all(
        online.map((box) =>
          berth.api.services(box).then(
            (s) => s.map((x) => ({ ...x, box, url: berth.api.serviceUrl(box, x.port) })),
            () => [] as Listening[],
          ),
        ),
      );
      if (live) setListening(all.flat());
    };
    void load();
    const t = setInterval(() => !document.hidden && void load(), 10_000);
    return () => {
      live = false;
      clearInterval(t);
    };
    // online is derived from key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stamp, berth]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const found: Configured[] = [];
      await Promise.all(
        online.map(async (box) => {
          const locs: Location[] = await berth.api.locations(box).catch(() => []);
          await Promise.all(
            locs.flatMap((l) =>
              (l.worktrees ?? []).map(async (w) => {
                const svcs = await berth.api.request<WorktreeService[]>(box, "GET", `locations/${encodeURIComponent(l.name)}/worktrees/${encodeURIComponent(w.name)}/services`).catch(() => []);
                for (const s of svcs ?? []) found.push({ ...s, box, location: l.name, worktree: w.name });
              }),
            ),
          );
        }),
      );
      if (live) setConfigured(found);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stamp, berth]);

  useEvent("service.*", reload);
  useEvent("worktree.created", reload);
  useEvent("worktree.removed", reload);
  return { listening, configured, reload };
}

function ServersStatus({ berth }: ScreenProps) {
  const { listening } = useServers(berth);
  if (!listening?.length) return null;
  return (
    <button type="button" className={sx(paint.s0)} onClick={() => berth.openScreen("servers")}>
      <Icon name="Radio" className={sx(paint.s1)} />
      {listening.length} {listening.length === 1 ? "server" : "servers"}
    </button>
  );
}

function ServersScreen({ berth }: ScreenProps) {
  const { listening, configured, reload } = useServers(berth);
  const current = useCurrentWorktree();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const by = new Map<string, Group>();
    const group = (box: string, location: string, worktree: string, main?: boolean) => {
      const key = `${box}/${location}/${worktree}`;
      let g = by.get(key);
      if (!g) by.set(key, (g = { key, box, location, worktree, main, listening: [], configured: [] }));
      return g;
    };
    for (const l of listening ?? []) group(l.box, l.location, l.worktree, l.main).listening.push(l);
    for (const c of configured) group(c.box, c.location, c.worktree).configured.push(c);
    const q = query.trim().toLowerCase();
    return [...by.values()]
      .filter((g) => !q || `${g.box} ${g.location} ${g.worktree} ${g.listening.map((l) => `${l.port} ${l.process}`).join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => b.listening.length - a.listening.length || a.key.localeCompare(b.key));
  }, [listening, configured, query]);

  return (
    <div className={sx(paint.s2)}>
      <ViewHeader
        title="Dev servers"
        description="Everything listening in a worktree on every box, and the services each repository runs."
        actions={
          <>
            <Input className={sx(paint.s3)} size="sm" placeholder="Filter by worktree, port…" value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} />
            <Tooltip>
              <TooltipTrigger render={<Button size="icon-sm" variant="ghost" onClick={reload} aria-label="Refresh" />}>
                <Icon name="RefreshCw" className={sx(paint.s4)} />
              </TooltipTrigger>
              <TooltipPopup>Refresh</TooltipPopup>
            </Tooltip>
          </>
        }
      />

      {!listening ? (
        <div className={sx(paint.s5)}>
          <Skeleton className={sx(paint.s6)} />
          <Skeleton className={sx(paint.s7)} />
        </div>
      ) : groups.length === 0 ? (
        <Empty pad="room">
          <EmptyHeader>
            <Icon name="Radio" className={sx(paint.s8)} />
            <EmptyTitle>{query ? "Nothing matches" : "Nothing is listening"}</EmptyTitle>
            <EmptyDescription>
              {query ? "Try another worktree or port." : <>Start a dev server in a worktree, or declare one under <code>services</code> in the repository's .berth/config.json, and it shows up here.</>}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        groups.map((g) => <WorktreeGroup key={g.key} group={g} berth={berth} here={current?.box === g.box && current.location === g.location && current.worktree === g.worktree} onChanged={reload} />)
      )}
    </div>
  );
}

function WorktreeGroup({ group: g, berth, here, onChanged }: { group: Group; berth: BerthPluginContext; here: boolean; onChanged(): void }) {
  const listeningPorts = new Set(g.listening.map((l) => l.port));
  return (
    <Frame variant="card">
      <FrameHeader row gap={2} pad="snug">
        <Icon name="GitBranch" className={sx(paint.s9)} />
        <FrameTitle truncate>{g.worktree}</FrameTitle>
        <span className={sx(paint.s10)}>{g.main ? g.box : `${g.location} · ${g.box}`}</span>
        {g.main && <Badge variant="outline" size="sm">main checkout</Badge>}
        {here && <Badge variant="secondary" size="sm">current worktree</Badge>}
      </FrameHeader>
      <FramePanel pad="none">
        <ul className={sx(paint.s11)}>
          {g.listening.map((l) => (
            <ServerRow key={`l${l.port}`} item={l} berth={berth} service={g.configured.find((c) => c.state === "running" && c.port === l.port)} onChanged={onChanged} />
          ))}
          {g.configured
            .filter((c) => !(c.state === "running" && c.port && listeningPorts.has(c.port)))
            .map((c) => (
              <ConfiguredRow key={`c${c.name}`} item={c} berth={berth} onChanged={onChanged} />
            ))}
        </ul>
      </FramePanel>
    </Frame>
  );
}

function ServerRow({ item: l, berth, service, onChanged }: { item: Listening; berth: BerthPluginContext; service?: Configured; onChanged(): void }) {
  const [copied, setCopied] = useState(false);
  const worktree = { box: l.box, location: l.location, worktree: l.worktree, path: l.path, main: l.main };
  const openInTab = (split?: "row") => {
    berth.openWorktree(worktree);
    berth.openBrowser(l.url, split ? { split } : undefined);
  };
  const stop = async () => {
    if (!service) return;
    await berth.api
      .request(service.box, "POST", `locations/${encodeURIComponent(service.location)}/worktrees/${encodeURIComponent(service.worktree)}/services/${encodeURIComponent(service.name)}/stop`)
      .catch((err) => berth.notify(`Couldn't stop ${service.name}`, String((err as Error).message ?? err)));
    onChanged();
  };
  return (
    <li className={[sx(paint.s12), "group"].filter(Boolean).join(" ")}>
      <span className={sx(paint.s13)} aria-label="listening" />
      <span className={sx(paint.s14)}>{l.port}</span>
      <span className={sx(paint.s15)}>
        {service && <span className={sx(paint.s16)}>{service.name}</span>}
        <span className={sx(paint.s17)}>{l.process ?? "listening"}</span>
        <span className={sx(paint.s18)}>{l.url.replace(/^https?:\/\//, "")}</span>
      </span>
      {copied && <span className={sx(paint.s19)}>Copied</span>}
      <Button size="xs" variant="outline" onClick={() => openInTab()}>
        <Icon name="AppWindow" className={sx(paint.s20)} /> Open in tab
      </Button>
      <Menu>
        <MenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label={`More for port ${l.port}`} />}>
          <Icon name="Ellipsis" className={sx(paint.s21)} />
        </MenuTrigger>
        <MenuPopup align="end" className={sx(paint.s22)}>
          <MenuItem onClick={() => openInTab("row")}>
            <Icon name="PanelRight" /> Open beside the terminal
          </MenuItem>
          <MenuItem onClick={() => berth.openUrl(l.url)}>
            <Icon name="ArrowUpRight" /> Open in your browser
          </MenuItem>
          <MenuItem
            onClick={() =>
              void navigator.clipboard?.writeText(l.url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
          >
            <Icon name="Copy" /> Copy URL
          </MenuItem>
          {service && (
            <>
              <MenuSeparator />
              <MenuItem onClick={() => void stop()}>
                <Icon name="Square" /> Stop {service.name}
              </MenuItem>
            </>
          )}
        </MenuPopup>
      </Menu>
    </li>
  );
}

function ConfiguredRow({ item: c, berth, onChanged }: { item: Configured; berth: BerthPluginContext; onChanged(): void }) {
  const [busy, setBusy] = useState(false);
  const running = c.state === "running";
  const act = async (action: "start" | "stop") => {
    setBusy(true);
    try {
      await berth.api.request(c.box, "POST", `locations/${encodeURIComponent(c.location)}/worktrees/${encodeURIComponent(c.worktree)}/services/${encodeURIComponent(c.name)}/${action}`);
      onChanged();
    } catch (err) {
      berth.notify(`Couldn't ${action} ${c.name}`, String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={sx(paint.s23)}>
      <span className={[sx(paint.n0), running ? sx(paint.n1) : c.state === "failed" ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")} aria-label={c.state} />
      <span className={sx(paint.s26)}>{c.name}</span>
      <Tooltip>
        <TooltipTrigger render={<span className={sx(paint.s27)}>{c.run}</span>} />
        <TooltipPopup width="lg">{c.run}</TooltipPopup>
      </Tooltip>
      <span className={sx(paint.s28)}>{running ? "running, not listening yet" : c.state}</span>
      {running ? (
        <Button size="xs" variant="outline" loading={busy} onClick={() => void act("stop")}>
          Stop
        </Button>
      ) : (
        <Button size="xs" loading={busy} onClick={() => void act("start")}>
          Start
        </Button>
      )}
    </li>
  );
}
