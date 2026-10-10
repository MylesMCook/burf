import * as stylex from "@stylexjs/stylex";
import type { BerthPluginContext, HomeWidgetProps, ScreenProps, Service, WorktreeSectionProps } from "@berth/plugin";
import { useBoxes, useWidgetData } from "@berth/plugin";
import { Badge, Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Icon, Spinner, WidgetEmpty, WidgetRow, WidgetSkeleton } from "@berth/plugin/ui";
import { useEffect, useState } from "react";

const paint = stylex.create({
  s0: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "width": "56px",
    "fontFamily": "var(--font-mono)",
  },
  s3: {
    "fontWeight": 500,
  },
  s4: {
    "color": "var(--muted-foreground)",
  },
  s5: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "marginLeft": "auto",
  },
  s7: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "6px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
  },
  s9: {
    "color": "var(--muted-foreground)",
  },
  s10: {
    "width": "48px",
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s12: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Hello ports: the smallest useful plugin, kept as an example of the SDK: a
// screen listing dev servers across boxes, a worktree section with the
// ports of the worktree in front, and an event handler.
// The built-in Dev servers plugin (plugins/dev-servers) does this properly.

interface Row extends Service {
  box: string;
}

// useServices polls every online box's services.
function useServices(berth: BerthPluginContext): Row[] | undefined {
  const boxes = useBoxes();
  const online = boxes.filter((b) => b.state === "online").map((b) => b.name);
  const key = online.join(",");
  const [rows, setRows] = useState<Row[]>();
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const all = await Promise.all(
        online.map((box) =>
          berth.api.services(box).then(
            (s) => s.map((x) => ({ ...x, box })),
            () => [] as Row[],
          ),
        ),
      );
      if (!cancelled) setRows(all.flat());
    };
    void load();
    const timer = setInterval(() => !document.hidden && void load(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // online is derived from key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, berth]);
  return rows;
}

function PortsScreen({ berth }: ScreenProps) {
  const rows = useServices(berth);
  return (
    <div>
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty space="10">
          <EmptyHeader>
            <EmptyTitle>Nothing is listening</EmptyTitle>
            <EmptyDescription>Start a dev server in a worktree and it shows up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className={sx(paint.s0)}>
          {rows.map((r) => (
            <li key={`${r.box}:${r.port}`} className={sx(paint.s1)}>
              <span className={sx(paint.s2)}>{r.port}</span>
              <span className={sx(paint.s3)}>{r.worktree}</span>
              <span className={sx(paint.s4)}>
                {r.location} · {r.box}
              </span>
              {r.main && <Badge variant="outline">main</Badge>}
              <span className={sx(paint.s5)}>{r.process}</span>
              <Button className={sx(paint.s6)} size="xs" variant="outline" onClick={() => berth.openUrl(berth.api.serviceUrl(r.box, r.port))}>
                <Icon name="ExternalLink" />
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// PortsHere is the worktree section: under the composer where work starts
// in a worktree, the ports listening in that worktree, one click from a
// browser tab beside the agent.
function PortsHere({ berth, box, path }: WorktreeSectionProps) {
  const rows = useServices(berth)?.filter((r) => r.box === box && r.path === path);
  if (!rows?.length) return <p className={sx(paint.s7)}>No ports open here yet.</p>;
  return (
    <div className={sx(paint.s8)}>
      {rows.map((r) => (
        <Button key={r.port} size="xs" variant="outline" onClick={() => berth.openBrowser(berth.api.serviceUrl(r.box, r.port))}>
          <Icon name="Radio" />
          {r.port}
          {r.process && <span className={sx(paint.s9)}>{r.process}</span>}
        </Button>
      ))}
    </div>
  );
}

// PortsWidget is a Home widget: the ports listening on every box. Home
// draws its card and menu; useWidgetData keeps the last read, shows it at
// once, and reads again every 30s, only while the widget is on screen.
function PortsWidget({ berth, size }: HomeWidgetProps) {
  const online = useBoxes()
    .filter((b) => b.state === "online")
    .map((b) => b.name);
  const { data } = useWidgetData<Row[]>(
    `ports:${online.join(",")}`,
    async () => (await Promise.all(online.map((box) => berth.api.services(box).then((s) => s.map((x) => ({ ...x, box })), () => [] as Row[])))).flat(),
    { every: 30_000 },
  );
  if (!data) return <WidgetSkeleton rows={3} />;
  if (!data.length) return <WidgetEmpty scene="dock" title="Nothing is listening" compact />;
  return (
    <div>
      {data.slice(0, size === "t" ? 8 : 3).map((r) => (
        <WidgetRow key={`${r.box}:${r.port}`} onClick={() => berth.openUrl(berth.api.serviceUrl(r.box, r.port))}>
          <span className={sx(paint.s10)}>:{r.port}</span>
          <span className={sx(paint.s11)}>{r.worktree}</span>
          <span className={sx(paint.s12)}>{r.box}</span>
        </WidgetRow>
      ))}
    </div>
  );
}

export default function activate(berth: BerthPluginContext) {
  berth.addHomeWidget({ id: "ports", title: "Hello ports", description: "Every port listening on every box. From the hello-ports example plugin.", icon: "Radio", sizes: ["s", "m", "t"], category: "Fleet", source: "Each online box's services, every 30s while on screen", Component: PortsWidget });
  berth.addScreen({ id: "ports", title: "Hello ports", description: "Everything listening in a worktree, on every box. From the hello-ports plugin.", Component: PortsScreen });
  berth.addSidebarItem({ id: "ports", title: "Hello ports", icon: "Radio", screen: "ports" });
  berth.addWorktreeSection({ id: "ports", title: "Hello ports", Component: PortsHere });
  berth.addCommand({ id: "ports", title: "Show dev servers", group: "Hello ports", run: () => berth.openScreen("ports") });
  berth.on("worktree.created", (e) => berth.notify("New worktree", `${String(e.data?.name ?? "")} on ${e.box ?? "a box"}`));
}
