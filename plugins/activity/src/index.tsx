import * as stylex from "@stylexjs/stylex";
import { definePlugin, useStorage, type BerthEvent, type ScreenProps } from "@berth/plugin";
import { Badge, BoxFilter, Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Icon, Input, PickOne, ViewHeader } from "@berth/plugin/ui";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

const paint = stylex.create({
  s0: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s1: {
    "color": "var(--warning)",
  },
  s2: {
    "color": "var(--success)",
  },
  s3: {
    "color": "var(--info)",
  },
  s4: {
    "color": "var(--muted-foreground)",
  },
  s5: {
    "color": "var(--info)",
  },
  s6: {
    "color": "var(--muted-foreground)",
  },
  s7: {
    "color": "var(--muted-foreground)",
  },
  s8: {
    "color": "var(--success)",
  },
  s9: {
    "color": "var(--destructive)",
  },
  s10: {
    "color": "var(--muted-foreground)",
  },
  s11: {
    "color": "var(--muted-foreground)",
  },
  s12: {
    "color": "var(--info)",
  },
  s13: {
    "color": "var(--muted-foreground)",
  },
  s14: {
    "color": "var(--success)",
  },
  s15: {
    "color": "var(--muted-foreground)",
  },
  s16: {
    "color": "var(--destructive)",
  },
  s17: {
    "color": "var(--success)",
  },
  s18: {
    "color": "var(--warning)",
  },
  s19: {
    "color": "var(--warning)",
  },
  s20: {
    "color": "var(--muted-foreground)",
  },
  s21: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s22: {
    "width": "208px",
  },
  s23: {
    "marginBottom": "12px",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
  },
  s24: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "marginBottom": "8px",
    "width": "20px",
    "height": "20px",
    "color": "var(--muted-foreground)",
  },
  s25: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s26: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "height": "1px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "var(--border)",
  },
  s28: {
    "height": "1px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "var(--border)",
  },
  s29: {
    "display": "flex",
    "minHeight": "var(--row-h)",
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": {
      "default": 1,
      ":last-child": 0,
    },
    "borderBottomStyle": {
      "default": "solid",
      ":last-child": "solid",
    },
    "borderBottomColor": {
      "default": "var(--border)",
      ":last-child": "var(--border)",
    },
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s30: {
    "borderTopWidth": 0,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
  },
  s31: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
  },
  s32: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s33: {
    "flexShrink": 0,
  },
  s34: {
    "display": "flex",
    "width": "56px",
    "flexShrink": 0,
    "justifyContent": "flex-end",
  },
  s35: {
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    ":is(.group:hover &)": {
      "opacity": 1,
    },
  },
  s36: {
    "width": "96px",
    "flexShrink": 0,
    "textAlign": "right",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  q37: {
    "color": "var(--warning)",
  },
  q38: {
    "color": "var(--success)",
  },
  q39: {
    "color": "var(--info)",
  },
  q40: {
    "color": "var(--muted-foreground)",
  },
  q41: {
    "color": "var(--info)",
  },
  q42: {
    "color": "var(--muted-foreground)",
  },
  q43: {
    "color": "var(--muted-foreground)",
  },
  q44: {
    "color": "var(--success)",
  },
  q45: {
    "color": "var(--destructive)",
  },
  q46: {
    "color": "var(--muted-foreground)",
  },
  q47: {
    "color": "var(--muted-foreground)",
  },
  q48: {
    "color": "var(--destructive)",
  },
  q49: {
    "color": "var(--success)",
  },
  q50: {
    "color": "var(--success)",
  },
  q51: {
    "color": "var(--muted-foreground)",
  },
  q52: {
    "color": "var(--destructive)",
  },
  q53: {
    "color": "var(--success)",
  },
  q54: {
    "color": "var(--warning)",
  },
  q55: {
    "color": "var(--warning)",
  },
  q56: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Activity: everything that happened on every box, as sentences, newest
// first, with a line marking where you left off. It keeps the last 300
// events on this computer, so a restart doesn't wipe "while you were away".

const KEEP = 300;

// Events worth a line. Anything else is noise here (the Automations page
// shows every raw event).
const INTERESTING = /^(agent\.|worktree\.(created|removed|setup\.(finished|failed))|session\.(started|stopped)|task\.created|flow\.finished|service\.(started|stopped|failed)|box\.(connected|disconnected)|notify|share\.started)/;

let log: BerthEvent[] = [];
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useLog = () => useSyncExternalStore(subscribe, () => log);

export default definePlugin((berth) => {
  log = berth.storage.get<BerthEvent[]>("events", []);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  berth.on("*", (e) => {
    if (!INTERESTING.test(e.type)) return;
    log = [e, ...log].slice(0, KEEP);
    for (const l of listeners) l();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => berth.storage.set("events", log), 1000);
  });
  berth.addScreen({ id: "activity", title: "Activity", Component: ActivityScreen });
  berth.addSidebarItem({ id: "activity", title: "Activity", icon: "History", screen: "activity" });
  berth.addCommand({ id: "activity", title: "Show activity", group: "Activity", run: () => berth.openScreen("activity") });
  return () => clearTimeout(saveTimer);
});

type Kind = "all" | "agents" | "worktrees" | "flows" | "boxes";

const kindOf = (t: string): Exclude<Kind, "all"> =>
  t.startsWith("agent.") || t.startsWith("session.") || t === "task.created" ? "agents" : t.startsWith("flow.") || t === "notify" ? "flows" : t.startsWith("box.") ? "boxes" : "worktrees";

function str(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

// Names maps "box:path" to "location/worktree", so an agent's event (which
// only knows its folder) reads as the worktree it is in.
type Names = Map<string, string>;

function where(e: BerthEvent, names?: Names): string {
  const d = e.data ?? {};
  const known = e.box && names?.get(`${e.box}:${str(d.path)}`);
  if (known) return known;
  const loc = str(d.location);
  if (loc.includes("/")) return loc;
  const name = str(d.name);
  if (loc && name && e.type.startsWith("worktree.")) return `${loc}/${name}`;
  if (loc) return loc;
  const path = str(d.path);
  return path ? path.split("/").filter(Boolean).slice(-1)[0] : "";
}

const AGENTS: Record<string, string> = { claude: "Claude", codex: "Codex", opencode: "OpenCode", gemini: "Gemini", cursor: "Cursor" };
const agentName = (a: string) => AGENTS[a] ?? (a || "An agent");

interface Line {
  icon: string;
  tone: string;
  text: React.ReactNode;
}

function describe(e: BerthEvent, names: Names): Line {
  const d = e.data ?? {};
  const w = <b className={sx(paint.s0)}>{where(e, names) || "a worktree"}</b>;
  // Agent hooks name the agent in data; events relayed from them may only
  // carry it as their origin.
  const agent = agentName(str(d.agent) || (e.origin && AGENTS[e.origin] ? e.origin : ""));
  switch (e.type) {
    case "agent.waiting":
      return { icon: "Hand", tone: sx(paint.q37), text: <>{agent} needs you in {w}{d.reason ? ` (${str(d.reason)})` : ""}</> };
    case "agent.finished":
      return { icon: "CircleCheck", tone: sx(paint.q38), text: <>{agent} finished its turn in {w}</> };
    case "agent.started":
      return { icon: "LoaderCircle", tone: sx(paint.q39), text: <>{agent} started working in {w}</> };
    case "agent.ready":
      return { icon: "Circle", tone: sx(paint.q40), text: <>{agent} is ready in {w}</> };
    case "task.created":
      return { icon: "Sparkles", tone: sx(paint.q41), text: <>New worktree {w}{d.agent ? <> with {agentName(str(d.agent))}</> : null}{d.from_session ? <> handed off from {str(d.from_session)}</> : null}</> };
    case "worktree.created":
      return { icon: "GitBranchPlus", tone: sx(paint.q42), text: <>Worktree {w} created{d.branch ? <> on {str(d.branch)}</> : null}</> };
    case "worktree.removed":
      return { icon: "Trash2", tone: sx(paint.q43), text: <>Worktree {w} removed</> };
    case "worktree.setup.finished":
      return { icon: "Wrench", tone: sx(paint.q44), text: <>Setup finished in {w}</> };
    case "worktree.setup.failed":
      return { icon: "Wrench", tone: sx(paint.q45), text: <>Setup failed in {w}{e.error ? `: ${e.error}` : ""}</> };
    case "session.started":
      return { icon: "SquareTerminal", tone: sx(paint.q46), text: <>Session {str(d.name)} started in {w}</> };
    case "session.stopped":
      return { icon: "SquareX", tone: sx(paint.q47), text: <>Session {str(d.name)} stopped</> };
    case "flow.finished":
      return { icon: "Workflow", tone: d.status === "failed" ? sx(paint.q48) : sx(paint.q49), text: <>Flow {str(d.flow)} {d.status === "failed" ? "failed" : "ran"}{where(e, names) ? <> for {w}</> : null}</> };
    case "notify":
      return { icon: "Bell", tone: sx(paint.s12), text: <>{str(d.title)}{d.body ? <span className={sx(paint.s13)}> — {str(d.body)}</span> : null}</> };
    case "service.started":
      return { icon: "Play", tone: sx(paint.q50), text: <>{str(d.service)} started in {w}{d.port ? ` on :${str(d.port)}` : ""}</> };
    case "service.stopped":
      return { icon: "Square", tone: sx(paint.q51), text: <>{str(d.service)} stopped in {w}</> };
    case "service.failed":
      return { icon: "CircleAlert", tone: sx(paint.q52), text: <>{str(d.service)} failed to start in {w}</> };
    case "box.connected":
      return { icon: "Plug", tone: sx(paint.q53), text: <>Connected to {e.box}</> };
    case "box.disconnected":
      return { icon: "Unplug", tone: sx(paint.q54), text: <>Lost {e.box}</> };
    case "share.started":
      return { icon: "Globe", tone: sx(paint.q55), text: <>Port {str(d.port)} shared publicly at {str(d.url)}</> };
  }
  return { icon: "Dot", tone: sx(paint.q56), text: e.type };
}

function clock(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function ActivityScreen({ berth }: ScreenProps) {
  const all = useLog();
  const [kind, setKind] = useState<Kind>("all");
  const [query, setQuery] = useState("");
  // Boxes turned off; every box is on until one is, as across the app.
  const [hiddenBoxes, setHiddenBoxes] = useStorage<string[]>("hiddenBoxes", []);
  // Where you left off: the newest event when you last looked.
  const [lastSeen, setLastSeen] = useStorage<string>("lastSeen", "");
  const [mark] = useState(lastSeen);
  useEffect(() => () => setLastSeen(new Date().toISOString()), [setLastSeen]);

  const boxes = useMemo(() => [...new Set(all.map((e) => e.box).filter(Boolean) as string[])].sort(), [all]);
  // A stored filter that hides every box there is now shows them all.
  const hidden = useMemo(() => new Set(boxes.every((b) => hiddenBoxes.includes(b)) ? [] : hiddenBoxes), [boxes, hiddenBoxes]);
  const [names, setNames] = useState<Names>(new Map());
  const boxKey = boxes.join(",");
  useEffect(() => {
    let live = true;
    void Promise.all(
      boxes.map((b) =>
        berth.api.locations(b).then(
          (locs) => locs.flatMap((l) => (l.worktrees ?? []).map((w) => [`${b}:${w.path}`, w.main ? l.name : `${l.name}/${w.name}`] as const)),
          () => [],
        ),
      ),
    ).then((pairs) => live && setNames(new Map(pairs.flat())));
    return () => {
      live = false;
    };
    // boxes is derived from boxKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxKey, berth]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((e) => (kind === "all" || kindOf(e.type) === kind) && (!e.box || !hidden.has(e.box)) && (!q || `${e.type} ${where(e, names)} ${JSON.stringify(e.data ?? {})}`.toLowerCase().includes(q)));
  }, [all, kind, hidden, query, names]);
  const unseen = mark ? shown.filter((e) => e.time > mark).length : 0;

  return (
    <div>
      <ViewHeader
        title="Activity"
        description={<>What agents, worktrees and flows did on every box{unseen > 0 ? <>, with <b className={sx(paint.s21)}>{unseen} new</b> since you last looked</> : null}.</>}
        actions={<Input className={sx(paint.s22)} size="sm" placeholder="Search…" value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} />}
      />
      <div className={sx(paint.s23)}>
        <PickOne
          label="Kind of event"
          value={kind}
          onChange={(v: string) => setKind(v as Kind)}
          options={[
            { value: "all", label: "All" },
            { value: "agents", label: "Agents" },
            { value: "worktrees", label: "Worktrees" },
            { value: "flows", label: "Flows" },
            { value: "boxes", label: "Boxes" },
          ]}
        />
        <BoxFilter align="end" boxes={boxes} hidden={hiddenBoxes} onChange={setHiddenBoxes} />
      </div>

      {shown.length === 0 ? (
        <Empty frame="panel" pad="room">
          <EmptyHeader>
            <Icon name="History" className={sx(paint.s24)} />
            <EmptyTitle>{all.length ? "Nothing matches" : "Nothing has happened yet"}</EmptyTitle>
            <EmptyDescription>{all.length ? "Try another filter." : "Agents finishing, worktrees appearing and flows running will show up here as they happen."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className={sx(paint.s25)}>
          {shown.map((e, i) => {
            const line = describe(e, names);
            const divider = mark && i > 0 && shown[i - 1].time > mark && e.time <= mark;
            const session = str(e.data?.session ?? (e.type.startsWith("session.") ? e.data?.name : ""));
            return (
              <li key={`${e.time}-${i}`}>
                {divider && (
                  <div className={sx(paint.s26)}>
                    <span className={sx(paint.s27)} /> Since you were last here <span className={sx(paint.s28)} />
                  </div>
                )}
                <div className={[[sx(paint.s29), "group"].filter(Boolean).join(" "), i === 0 && sx(paint.s30)].filter(Boolean).join(" ")}>
                  <Icon name={line.icon} className={[sx(paint.s31), line.tone].filter(Boolean).join(" ")} />
                  <span className={sx(paint.s32)}>{line.text}</span>
                  {e.box && (
                    <Badge variant="outline" size="sm" className={sx(paint.s33)}>
                      {e.box}
                    </Badge>
                  )}
                  {/* A slot every row has, so the box badges line up whether
                      or not the row can be opened. */}
                  <span className={sx(paint.s34)}>
                    {session && e.box && e.type !== "session.stopped" && (
                      <Button size="xs" variant="ghost" className={sx(paint.s35)} onClick={() => berth.openTerminal(e.box!, session)}>
                        Open
                      </Button>
                    )}
                  </span>
                  <time className={sx(paint.s36)} dateTime={e.time}>
                    {clock(e.time)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
