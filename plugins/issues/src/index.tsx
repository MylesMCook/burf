import * as stylex from "@stylexjs/stylex";
import { type Project, type ScreenProps, type Session, definePlugin, useCurrentWorktree, useProjects, useSessions, useStorage } from "@berth/plugin";
import {
  Button,
  Checkbox,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FilterChip,
  Icon,
  Input,
  Kbd,
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
  PickOne,
  Skeleton,
  Tip,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
  ViewHeader,
} from "@berth/plugin/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, Detail, LabelChip, PrIcon, Problem, type Row, StatePill } from "./detail";
import * as gh from "./gh";
import { StartSheet, type Target } from "./start-sheet";
import { type Run, askRefresh, isGitHubProject, listOf, loadList, refreshCount, runnerOf, runsByIssue, useIssuesStore } from "./store";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s1: {
    "width": "14px",
    "height": "14px",
  },
  s2: {
    "marginBottom": "8px",
    "width": "24px",
    "height": "24px",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "display": "flex",
    "flexShrink": 0,
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s4: {
    "position": "relative",
  },
  s5: {
    "pointerEvents": "none",
    "position": "absolute",
    "left": "8px",
    "zIndex": 10,
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s6: {
    "width": "208px",
    ":not(#\\#) input": {
      "paddingLeft": "28px",
    },
  },
  s7: {
    "pointerEvents": "none",
    "position": "absolute",
    "right": "6px",
    "height": "18px",
    "fontSize": "10px",
  },
  s8: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "4px",
  },
  s9: {
    "fontSize": "11px",
  },
  s10: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s12: {
    "display": "flex",
    "flexShrink": 0,
    "flexWrap": "wrap",
    "columnGap": "16px",
    "rowGap": "4px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s14: {
    "width": "12px",
    "height": "12px",
  },
  s15: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s16: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s17: {
    "display": "flex",
    "width": "25rem",
    "flexShrink": 0,
    "flexDirection": "column",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s18: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "padding": "8px",
  },
  s19: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "padding": "4px",
  },
  s20: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
  },
  s21: {
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s22: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "32px",
    "paddingBottom": "32px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "marginLeft": "4px",
    "fontWeight": 500,
    "color": "var(--foreground)",
    "textDecoration": {
      ":hover": "underline",
    },
  },
  s24: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s25: {
    "fontWeight": 500,
  },
  s26: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s27: {
    "marginLeft": "auto",
  },
  s28: {
    "width": "14px",
    "height": "14px",
  },
  s29: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "10px",
    "overflow": "hidden",
    "whiteSpace": "nowrap",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s30: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s31: {
    "height": "16px",
    "minWidth": "16px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontSize": "10px",
  },
  s32: {
    "marginLeft": "auto",
    "fontVariantNumeric": "tabular-nums",
  },
  s33: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
  },
  s34: {
    "display": "grid",
    "height": "100%",
    "placeItems": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s35: {
    "display": "flex",
    "width": "100%",
    "cursor": "default",
    "gap": "10px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "left",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s36: {
    "backgroundColor": {
      "default": "var(--accent)",
      ":hover": "var(--accent)",
    },
  },
  s37: {
    "position": "relative",
    "marginTop": "3px",
    "display": "grid",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "placeItems": "center",
  },
  s38: {
    "width": "14px",
    "height": "14px",
    "color": "var(--success)",
  },
  s39: {
    "display": "none",
  },
  s40: {
    ":is(.group:hover &)": {
      "display": "none",
    },
  },
  s41: {
    "display": "none",
  },
  s42: {
    "display": "flex",
  },
  s43: {
    ":is(.group:hover &)": {
      "display": "flex",
    },
  },
  s44: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "4px",
  },
  s45: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "fontWeight": 500,
    "fontSize": "13px",
    "lineHeight": "1.375",
  },
  s46: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s47: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontVariantNumeric": "tabular-nums",
  },
  s48: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s49: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
    "overflow": "hidden",
  },
  s50: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": {
      "default": "var(--background)",
      ":hover": "var(--accent)",
    },
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
  },
  s51: {
    "maxWidth": "112px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s52: {
    "flexShrink": 0,
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s53: {
    "display": "flex",
    "flexShrink": 0,
    "flexDirection": "column",
    "alignItems": "flex-end",
    "gap": "6px",
    "paddingTop": "1px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s54: {
    "display": "flex",
  },
  s55: {
    "width": "16px",
    "height": "16px",
    "fontSize": "8px",
    "boxShadow": "0 0 0 2px var(--background)",
  },
  s56: {
    "boxShadow": "0 0 0 2px color-mix(in oklab, var(--primary) 60%, transparent)",
  },
  s57: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s58: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s59: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
    "fontVariantNumeric": "tabular-nums",
  },
  s60: {
    "width": "12px",
    "height": "12px",
  },
  s61: {
    "display": "flex",
    "gap": "10px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s62: {
    "marginTop": "2px",
    "width": "14px",
    "height": "14px",
    "borderRadius": "999px",
  },
  s63: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "6px",
  },
  s64: {
    "height": "14px",
  },
  s65: {
    "height": "12px",
  },
  s66: {
    "maxWidth": "224px",
  },
  s67: {
    "width": "14px",
    "height": "14px",
  },
  s68: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s69: {
    "width": "12px",
    "height": "12px",
    "opacity": 0.6,
  },
  s70: {
    "minWidth": "224px",
  },
  s71: {
    "width": "14px",
    "height": "14px",
  },
  s72: {
    "marginLeft": "auto",
    "width": "14px",
    "height": "14px",
  },
  s73: {
    "width": "14px",
    "height": "14px",
  },
  s74: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s75: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s76: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s77: {
    "marginLeft": "auto",
    "width": "14px",
    "height": "14px",
  },
  s78: {
    "color": "var(--muted-foreground)",
  },
  s79: {
    "width": "14px",
    "height": "14px",
  },
  s80: {
    "marginLeft": "auto",
    "width": "14px",
    "height": "14px",
  },
  q81: {
    "width": {
      "@media (max-width: 1279px)": {
        "default": "21rem",
      },
    },
  },
  q82: {
    "top": "50%",
    "transform": "translateY(-50%)",
  },
  q83: {
    "top": "50%",
    "transform": "translateY(-50%)",
  },
  q84: {
    "width": "80%",
  },
  q85: {
    "width": "40%",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Issues: the open GitHub issues of a project (or of every project), read
// with gh on the project's box, and an agent on any of them in one step: a
// worktree named for the issue, the agent you pick, and the issue as its
// first prompt. Rows show how that agent is doing from then on.

export default definePlugin((berth) => {
  berth.addScreen({ id: "issues", title: "Issues", layout: "fill", Component: IssuesScreen });
  berth.addSidebarItem({ id: "issues", title: "Issues", icon: "CircleDot", screen: "issues" });
  berth.addCommand({ id: "issues", title: "Show issues", group: "Issues", run: () => berth.openScreen("issues") });
  berth.addCommand({
    id: "issues-refresh",
    title: "Refresh issues",
    group: "Issues",
    run: () => {
      askRefresh();
      berth.openScreen("issues");
    },
  });
});

type Who = "all" | "mine" | "unassigned";
type Sort = "updated" | "newest" | "discussed";

const ALL = "all";

function IssuesScreen({ berth }: ScreenProps) {
  useIssuesStore();
  const allProjects = useProjects();
  const projects = useMemo(() => allProjects.filter(isGitHubProject), [allProjects]);
  const current = useCurrentWorktree();

  // Which project: the stored choice, or the one in front, or all of them.
  const [stored, setStored] = useStorage<string>("project", "");
  const fromCurrent = current && projects.find((p) => p.members.some((m) => m.box === current.box && m.location.name === current.location))?.id;
  const scope = stored === ALL || projects.some((p) => p.id === stored) ? stored : (fromCurrent ?? (projects.length === 1 ? projects[0].id : ALL));
  const shown = useMemo(() => (scope === ALL ? projects : projects.filter((p) => p.id === scope)), [projects, scope]);
  const scoped = scope !== ALL ? shown[0] : undefined;

  const [who, setWho] = useStorage<Who>("who", "all");
  const [sort, setSort] = useStorage<Sort>("sort", "updated");
  const [labels, setLabels] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);

  // Fetch what's shown, again when asked from the palette.
  const tick = refreshCount();
  const lastTick = useRef(tick);
  const shownKey = shown.map((p) => `${p.id}@${runnerOf(p)?.box ?? ""}`).join(",");
  useEffect(() => {
    const force = lastTick.current !== tick;
    lastTick.current = tick;
    for (const p of shown) void loadList(berth, p, force);
    // shown is keyed by shownKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berth, shownKey, tick]);
  const refresh = () => {
    for (const p of shown) void loadList(berth, p, true);
  };

  const loads = shown.map((p) => ({ project: p, load: listOf(p.id) }));
  const loading = loads.some((l) => !l.load || l.load.status === "loading");
  const problems = loads.filter((l) => l.load?.status === "problem") as { project: Project; load: { status: "problem"; problem: gh.Problem } }[];
  const viewers = new Set(loads.map((l) => (l.load?.status === "ok" ? l.load.value.viewer : l.load?.status === "loading" ? l.load.prev?.viewer : undefined)).filter(Boolean) as string[]);
  const viewer = [...viewers][0];

  const rows: Row[] = useMemo(
    () =>
      loads.flatMap(({ project, load }) => {
        const list = load?.status === "ok" ? load.value : load?.status === "loading" ? load.prev : undefined;
        const repo = list?.repo || project.slug!;
        return (list?.issues ?? []).map((i) => ({ ...i, key: `${repo.toLowerCase()}#${i.number}`, repo, project }));
      }),
    // loads is rebuilt every render; the store version drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loads.map((l) => (l.load?.status === "ok" ? l.load.at : l.load?.status)).join(","), shownKey],
  );
  const total = loads.reduce((n, l) => n + (l.load?.status === "ok" ? l.load.value.total : 0), 0);

  // Agents on issues: every box the shown projects are on.
  const boxes = useMemo(() => [...new Set(shown.flatMap((p) => p.members.map((m) => m.box)))].sort(), [shown]);
  const [sessions, setSessions] = useState<Record<string, Session[] | undefined>>({});
  const onSessions = useCallback((box: string, s?: Session[]) => setSessions((prev) => (prev[box] === s ? prev : { ...prev, [box]: s })), []);
  const runs = useMemo(() => runsByIssue(shown, sessions), [shown, sessions]);

  const labelCounts = useMemo(() => {
    const m = new Map<string, gh.Label & { n: number }>();
    for (const r of rows) for (const l of r.labels) m.set(l.name, { ...l, n: (m.get(l.name)?.n ?? 0) + 1 });
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [rows]);
  useEffect(() => setLabels((ls) => ls.filter((l) => labelCounts.some((c) => c.name === l))), [labelCounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    const out = rows.filter(
      (r) =>
        (who === "all" || (who === "mine" ? !!viewer && r.assignees.includes(viewer) : r.assignees.length === 0)) &&
        labels.every((l) => r.labels.some((x) => x.name === l)) &&
        (!q || String(r.number).startsWith(q) || `${r.title} ${r.author ?? ""} ${r.labels.map((l) => l.name).join(" ")} ${r.assignees.join(" ")}`.toLowerCase().includes(q)),
    );
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      discussed: (a, b) => b.comments - a.comments || b.updatedAt.localeCompare(a.updatedAt),
    };
    return out.sort(by[sort]);
  }, [rows, who, viewer, labels, query, sort]);

  // Selection: the issue in the right-hand pane, and the ones ticked for a batch.
  const [selectedKey, setSelectedKey] = useState<string>();
  const selected = filtered.find((r) => r.key === selectedKey) ?? filtered[0];
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const checkedRows = filtered.filter((r) => checked.has(r.key));
  const toggle = (key: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (!n.delete(key)) n.add(key);
      return n;
    });

  const [targets, setTargets] = useState<Target[]>([]);
  const targetOf = (r: Row): Target => ({ project: r.project, repo: r.repo, number: r.number, title: r.title, runs: runs.get(r.key) ?? [] });
  const startOn = (rs: Row[]) => rs.length && setTargets(rs.map(targetOf));

  // Keys: J/K move, X ticks, S starts, O opens on GitHub, / searches.
  const keys = useRef({ filtered, selected, checkedRows, targets });
  keys.current = { filtered, selected, checkedRows, targets };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || keys.current.targets.length) return;
      if (t && (t.closest("input, textarea, [contenteditable=true], [role=dialog], [role=menu]") || t.isContentEditable)) {
        if (e.key === "Escape" && t === search.current) search.current?.blur();
        return;
      }
      const { filtered: list, selected: sel, checkedRows: ticked } = keys.current;
      const i = sel ? list.indexOf(sel) : -1;
      const move = (d: number) => {
        const next = list[Math.min(list.length - 1, Math.max(0, i + d))];
        if (!next) return;
        setSelectedKey(next.key);
        document.getElementById(`issue-${next.key}`)?.scrollIntoView({ block: "nearest" });
      };
      if (e.key === "j" || e.key === "ArrowDown") move(1);
      else if (e.key === "k" || e.key === "ArrowUp") move(-1);
      else if (e.key === "x" && sel) toggle(sel.key);
      else if (e.key === "s") startOn(ticked.length ? ticked : sel ? [sel] : []);
      else if (e.key === "o" && sel) berth.openUrl(gh.issueUrl(sel.repo, sel.number));
      else if (e.key === "/") search.current?.focus();
      else if (e.key === "Escape") setChecked(new Set());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // startOn and toggle only use setters and the refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berth]);

  const busyRuns = useMemo(() => [...runs.values()].filter((rs) => rs[0]?.session && rs[0].session.agent_state !== "finished").length, [runs]);

  return (
    <div className={sx(paint.s0)}>
      {boxes.map((b) => (
        <SessionFeed key={b} box={b} onSessions={onSessions} />
      ))}
      <ViewHeader
        title="Issues"
        description={busyRuns > 0 ? `${busyRuns} agent${busyRuns === 1 ? " is" : "s are"} on issues right now.` : "Open GitHub issues, and an agent on any of them in one step."}
        actions={
          <>
            <ProjectPicker projects={projects} scope={scope} onChange={(id) => (setStored(id), setChecked(new Set()))} />
            <Tooltip>
              <TooltipTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Refresh" onClick={refresh} disabled={!shown.length} />}>
                <Icon name="RefreshCw" className={[sx(paint.s1), loading && shown.length > 0 && "burf-spin"].filter(Boolean).join(" ")} />
              </TooltipTrigger>
              <TooltipPopup>Refresh</TooltipPopup>
            </Tooltip>
          </>
        }
      />

      {projects.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <Icon name="CircleDot" className={sx(paint.s2)} />
            <EmptyTitle>No GitHub projects yet</EmptyTitle>
            <EmptyDescription>Add a repository whose origin is on GitHub to a box, and its open issues show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className={sx(paint.s3)}>
            <div className={sx(paint.s4)}>
              <Icon name="Search" className={[sx(paint.s5), sx(paint.q82)].filter(Boolean).join(" ")} />
              <Input
                ref={search}
                size="sm"
                className={sx(paint.s6)}
                placeholder="Search issues"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              />
              {!query && <Kbd className={[sx(paint.s7), sx(paint.q83)].filter(Boolean).join(" ")}>/</Kbd>}
            </div>
            <PickOne
              label="Assignee"
              value={who}
              onChange={(v: string) => setWho(v as Who)}
              options={[
                { value: "all", label: "All" },
                { value: "mine", label: "Mine" },
                { value: "unassigned", label: "Unassigned" },
              ]}
            />
            <SortMenu sort={sort} onChange={setSort} />
            {/* The labels wrap rather than scroll out of sight: a hidden
                scrollbar cut the last ones off with no sign of more. */}
            <div className={sx(paint.s8)}>
              {labelCounts.slice(0, 10).map((l) => (
                <FilterChip key={l.name} className={sx(paint.s9)} pressed={labels.includes(l.name)} onPressedChange={(on: boolean) => setLabels((ls) => (on ? [...ls, l.name] : ls.filter((x) => x !== l.name)))}>
                  <span className={sx(paint.s10)} style={{ backgroundColor: `#${l.color}` }} />
                  <span className={sx(paint.s11)}>{l.name}</span>
                </FilterChip>
              ))}
            </div>
          </div>

          {problems.length > 0 && scope === ALL && rows.length > 0 && (
            <div className={sx(paint.s12)}>
              {problems.map(({ project, load }) => (
                <span key={project.id} className={sx(paint.s13)}>
                  <Icon name="Info" className={sx(paint.s14)} />
                  <b className={sx(paint.s15)}>{project.name}</b> {problemShort(load.problem)}
                </span>
              ))}
            </div>
          )}

          <div className={sx(paint.s16)}>
            <aside className={[sx(paint.s17), sx(paint.q81)].filter(Boolean).join(" ")}>
              <ul className={sx(paint.s18)} aria-label="Open issues">
                {rows.length === 0 && loading ? (
                  Array.from({ length: 7 }, (_, i) => <RowSkeleton key={i} />)
                ) : rows.length === 0 && problems.length > 0 ? (
                  <div className={sx(paint.s19)}>
                    {problems.map(({ project, load }) => (
                      <div key={project.id} className={sx(paint.s20)}>
                        {scope === ALL && <span className={sx(paint.s21)}>{project.name}</span>}
                        <Problem problem={load.problem} box={runnerOf(project)?.box} />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <p className={sx(paint.s22)}>
                    {rows.length === 0 ? "No open issues. Nice." : "No issues match."}
                    {rows.length > 0 && (
                      <button
                        type="button"
                        className={sx(paint.s23)}
                        onClick={() => {
                          setQuery("");
                          setLabels([]);
                          setWho("all");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </p>
                ) : (
                  filtered.map((r) => (
                    <IssueRow
                      key={r.key}
                      row={r}
                      showRepo={scope === ALL && shown.length > 1}
                      viewer={viewer}
                      run={runs.get(r.key)?.[0]}
                      active={r.key === selected?.key}
                      checked={checked.has(r.key)}
                      selecting={checked.size > 0}
                      onSelect={() => setSelectedKey(r.key)}
                      onCheck={() => toggle(r.key)}
                      onOpenRun={(run) => berth.openWorktree({ box: run.box, location: run.location, worktree: run.worktree, path: run.path })}
                    />
                  ))
                )}
              </ul>
              {checkedRows.length > 0 ? (
                <footer className={sx(paint.s24)}>
                  <span className={sx(paint.s25)}>{checkedRows.length} selected</span>
                  <button type="button" className={sx(paint.s26)} onClick={() => setChecked(new Set())}>
                    Clear
                  </button>
                  <Button size="xs" className={sx(paint.s27)} onClick={() => startOn(checkedRows)}>
                    <Icon name="Bot" className={sx(paint.s28)} />
                    Start {checkedRows.length} agent{checkedRows.length === 1 ? "" : "s"}
                  </Button>
                </footer>
              ) : (
                <footer className={sx(paint.s29)}>
                  {(
                    [
                      ["J K", "move"],
                      ["X", "select"],
                      ["S", "start agent"],
                      ["O", "GitHub"],
                    ] as const
                  ).map(([k, label]) => (
                    <span key={label} className={sx(paint.s30)}>
                      {k.split(" ").map((x) => (
                        <Kbd key={x} className={sx(paint.s31)}>
                          {x}
                        </Kbd>
                      ))}
                      {label}
                    </span>
                  ))}
                  <span className={sx(paint.s32)}>
                    {filtered.length === rows.length ? `${rows.length}` : `${filtered.length} of ${rows.length}`}
                    {total > rows.length ? ` · ${total} open` : ""}
                  </span>
                </footer>
              )}
            </aside>
            <section className={sx(paint.s33)}>
              {selected ? (
                <Detail key={selected.key} berth={berth} row={selected} runs={runs.get(selected.key) ?? []} viewer={viewer} onStart={() => startOn([selected])} />
              ) : (
                <div className={sx(paint.s34)}>{loading ? "" : "Pick an issue to read it."}</div>
              )}
            </section>
          </div>
        </>
      )}
      <StartSheet berth={berth} targets={targets} onClose={() => setTargets([])} onStarted={() => setChecked(new Set())} />
    </div>
  );
}

// SessionFeed hands a box's live sessions up, so rows can follow agents on
// every box the shown projects are on.
function SessionFeed({ box, onSessions }: { box: string; onSessions(box: string, s?: Session[]): void }) {
  const s = useSessions(box);
  useEffect(() => onSessions(box, s), [box, s, onSessions]);
  return null;
}

function IssueRow({
  row,
  showRepo,
  viewer,
  run,
  active,
  checked,
  selecting,
  onSelect,
  onCheck,
  onOpenRun,
}: {
  row: Row;
  showRepo: boolean;
  viewer?: string;
  run?: Run;
  active: boolean;
  checked: boolean;
  selecting: boolean;
  onSelect(): void;
  onCheck(): void;
  onOpenRun(run: Run): void;
}) {
  const openPR = row.prs.find((p) => p.state === "OPEN") ?? row.prs.find((p) => p.state === "MERGED") ?? row.prs[0];
  return (
    <li id={`issue-${row.key}`}>
      {/* biome-ignore lint/a11y/useSemanticElements: the row holds a checkbox, so it can't be a button. */}
      <div
        role="button"
        tabIndex={-1}
        onClick={onSelect}
        onKeyDown={undefined}
        aria-current={active || undefined}
        className={[[sx(paint.s35), "group"].filter(Boolean).join(" "), active && sx(paint.s36)].filter(Boolean).join(" ")}
      >
        <span className={sx(paint.s37)}>
          <Icon name="CircleDot" className={[sx(paint.s38), (selecting || checked) && sx(paint.s39), sx(paint.s40)].filter(Boolean).join(" ")} />
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stops the row's click. */}
          <span className={[sx(paint.s41), (selecting || checked) && sx(paint.s42), sx(paint.s43)].filter(Boolean).join(" ")} onClick={(e) => e.stopPropagation()} onKeyDown={undefined}>
            <Checkbox checked={checked} onCheckedChange={onCheck} aria-label={`Select #${row.number}`} />
          </span>
        </span>
        <span className={sx(paint.s44)}>
          <span className={sx(paint.s45)}>{row.title}</span>
          <span className={sx(paint.s46)}>
            <span className={sx(paint.s47)}>{showRepo ? `${row.repo.split("/")[1]}#${row.number}` : `#${row.number}`}</span>
            <span className={sx(paint.s48)}>
              · {gh.since(row.updatedAt)} · {row.author ?? "ghost"}
            </span>
          </span>
          {(row.labels.length > 0 || run) && (
            <span className={sx(paint.s49)}>
              {run && (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the issue's own keys reach it.
                <Tip label={`${run.worktree} on ${run.box}: open it`}>
                  <span
                    className={sx(paint.s50)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenRun(run);
                    }}
                  >
                    <StatePill run={run} compact />
                    <span className={sx(paint.s51)}>{run.session ? run.box : run.worktree}</span>
                  </span>
                </Tip>
              )}
              {row.labels.slice(0, 3).map((l) => (
                <LabelChip key={l.name} label={l} />
              ))}
              {row.labels.length > 3 && <span className={sx(paint.s52)}>+{row.labels.length - 3}</span>}
            </span>
          )}
        </span>
        <span className={sx(paint.s53)}>
          <span className={[sx(paint.s54), "-space-x-1"].filter(Boolean).join(" ")}>
            {row.assignees.slice(0, 2).map((a) => (
              <Avatar key={a} login={a} className={[sx(paint.s55), a === viewer && sx(paint.s56)].filter(Boolean).join(" ")} />
            ))}
          </span>
          <span className={sx(paint.s57)}>
            {openPR && (
              <Tip label={`#${openPR.number} ${openPR.state.toLowerCase()}`}>
                <span role="img" aria-label={`Pull request #${openPR.number} ${openPR.state.toLowerCase()}`} className={sx(paint.s58)}>
                  <PrIcon pr={openPR} />
                </span>
              </Tip>
            )}
            {row.comments > 0 && (
              <span className={sx(paint.s59)}>
                <Icon name="MessageSquare" className={sx(paint.s60)} />
                {row.comments}
              </span>
            )}
          </span>
        </span>
      </div>
    </li>
  );
}

function RowSkeleton() {
  return (
    <li className={sx(paint.s61)}>
      <Skeleton className={sx(paint.s62)} />
      <div className={sx(paint.s63)}>
        <Skeleton className={[sx(paint.s64), sx(paint.q84)].filter(Boolean).join(" ")} />
        <Skeleton className={[sx(paint.s65), sx(paint.q85)].filter(Boolean).join(" ")} />
      </div>
    </li>
  );
}

function ProjectPicker({ projects, scope, onChange }: { projects: Project[]; scope: string; onChange(id: string): void }) {
  const current = projects.find((p) => p.id === scope);
  if (projects.length === 0) return null;
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="outline" className={sx(paint.s66)} />}>
        <Icon name={current ? "FolderGit2" : "Layers"} className={sx(paint.s67)} />
        <span className={sx(paint.s68)}>{current ? current.name : "All projects"}</span>
        <Icon name="ChevronsUpDown" className={sx(paint.s69)} />
      </MenuTrigger>
      <MenuPopup align="end" className={sx(paint.s70)}>
        <MenuItem onClick={() => onChange(ALL)}>
          <Icon name="Layers" className={sx(paint.s71)} />
          All projects
          {scope === ALL && <Icon name="Check" className={sx(paint.s72)} />}
        </MenuItem>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>Projects on GitHub</MenuGroupLabel>
          {projects.map((p) => (
            <MenuItem key={p.id} onClick={() => onChange(p.id)}>
              <Icon name="FolderGit2" className={sx(paint.s73)} />
              <span className={sx(paint.s74)}>
                <span className={sx(paint.s75)}>{p.name}</span>
                <span className={sx(paint.s76)}>{p.slug}</span>
              </span>
              {scope === p.id && <Icon name="Check" className={sx(paint.s77)} />}
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

const SORTS: Record<Sort, string> = { updated: "Recently updated", newest: "Newest", discussed: "Most discussed" };

function SortMenu({ sort, onChange }: { sort: Sort; onChange(s: Sort): void }) {
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="ghost" className={sx(paint.s78)} />}>
        <Icon name="ArrowDownWideNarrow" className={sx(paint.s79)} />
        {SORTS[sort]}
      </MenuTrigger>
      <MenuPopup align="start">
        {(Object.keys(SORTS) as Sort[]).map((s) => (
          <MenuItem key={s} onClick={() => onChange(s)}>
            {SORTS[s]}
            {s === sort && <Icon name="Check" className={sx(paint.s80)} />}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

function problemShort(p: gh.Problem) {
  switch (p.kind) {
    case "disabled":
      return "has issues turned off";
    case "no-gh":
      return "needs gh on its box";
    case "no-auth":
      return "needs gh auth login on its box";
    case "offline":
      return "has no box online";
    case "not-github":
      return "isn't on GitHub";
    default:
      return "couldn't be read";
  }
}
