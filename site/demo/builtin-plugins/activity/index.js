// ../plugins/activity/src/index.tsx
import { definePlugin, useStorage } from "@berth/plugin";
import { Badge, BoxFilter, Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Icon, Input, PickOne, ViewHeader, cn } from "@berth/plugin/ui";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var KEEP = 300;
var INTERESTING = /^(agent\.|worktree\.(created|removed|setup\.(finished|failed))|session\.(started|stopped)|task\.created|flow\.finished|service\.(started|stopped|failed)|box\.(connected|disconnected)|notify|share\.started)/;
var log = [];
var listeners = /* @__PURE__ */ new Set();
var subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
var useLog = () => useSyncExternalStore(subscribe, () => log);
var index_default = definePlugin((berth) => {
  log = berth.storage.get("events", []);
  let saveTimer;
  berth.on("*", (e) => {
    if (!INTERESTING.test(e.type)) return;
    log = [e, ...log].slice(0, KEEP);
    for (const l of listeners) l();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => berth.storage.set("events", log), 1e3);
  });
  berth.addScreen({ id: "activity", title: "Activity", Component: ActivityScreen });
  berth.addSidebarItem({ id: "activity", title: "Activity", icon: "History", screen: "activity" });
  berth.addCommand({ id: "activity", title: "Show activity", group: "Activity", run: () => berth.openScreen("activity") });
  return () => clearTimeout(saveTimer);
});
var kindOf = (t) => t.startsWith("agent.") || t.startsWith("session.") || t === "task.created" ? "agents" : t.startsWith("flow.") || t === "notify" ? "flows" : t.startsWith("box.") ? "boxes" : "worktrees";
function str(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function where(e, names) {
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
var AGENTS = { claude: "Claude", codex: "Codex", opencode: "OpenCode", gemini: "Gemini", cursor: "Cursor" };
var agentName = (a) => AGENTS[a] ?? (a || "An agent");
function describe(e, names) {
  const d = e.data ?? {};
  const w = /* @__PURE__ */ jsx("b", { className: "font-medium text-foreground", children: where(e, names) || "a worktree" });
  const agent = agentName(str(d.agent) || (e.origin && AGENTS[e.origin] ? e.origin : ""));
  switch (e.type) {
    case "agent.waiting":
      return { icon: "Hand", tone: "text-warning", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        agent,
        " needs you in ",
        w,
        d.reason ? ` (${str(d.reason)})` : ""
      ] }) };
    case "agent.finished":
      return { icon: "CircleCheck", tone: "text-success", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        agent,
        " finished its turn in ",
        w
      ] }) };
    case "agent.started":
      return { icon: "LoaderCircle", tone: "text-info", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        agent,
        " started working in ",
        w
      ] }) };
    case "agent.ready":
      return { icon: "Circle", tone: "text-muted-foreground", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        agent,
        " is ready in ",
        w
      ] }) };
    case "task.created":
      return { icon: "Sparkles", tone: "text-info", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "New worktree ",
        w,
        d.agent ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " with ",
          agentName(str(d.agent))
        ] }) : null,
        d.from_session ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " handed off from ",
          str(d.from_session)
        ] }) : null
      ] }) };
    case "worktree.created":
      return { icon: "GitBranchPlus", tone: "text-muted-foreground", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Worktree ",
        w,
        " created",
        d.branch ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " on ",
          str(d.branch)
        ] }) : null
      ] }) };
    case "worktree.removed":
      return { icon: "Trash2", tone: "text-muted-foreground", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Worktree ",
        w,
        " removed"
      ] }) };
    case "worktree.setup.finished":
      return { icon: "Wrench", tone: "text-success", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Setup finished in ",
        w
      ] }) };
    case "worktree.setup.failed":
      return { icon: "Wrench", tone: "text-destructive", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Setup failed in ",
        w,
        e.error ? `: ${e.error}` : ""
      ] }) };
    case "session.started":
      return { icon: "SquareTerminal", tone: "text-muted-foreground", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Session ",
        str(d.name),
        " started in ",
        w
      ] }) };
    case "session.stopped":
      return { icon: "SquareX", tone: "text-muted-foreground", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Session ",
        str(d.name),
        " stopped"
      ] }) };
    case "flow.finished":
      return { icon: "Workflow", tone: d.status === "failed" ? "text-destructive" : "text-success", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Flow ",
        str(d.flow),
        " ",
        d.status === "failed" ? "failed" : "ran",
        where(e, names) ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " for ",
          w
        ] }) : null
      ] }) };
    case "notify":
      return { icon: "Bell", tone: "text-info", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        str(d.title),
        d.body ? /* @__PURE__ */ jsxs("span", { className: "text-muted-foreground", children: [
          " \u2014 ",
          str(d.body)
        ] }) : null
      ] }) };
    case "service.started":
      return { icon: "Play", tone: "text-success", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        str(d.service),
        " started in ",
        w,
        d.port ? ` on :${str(d.port)}` : ""
      ] }) };
    case "service.stopped":
      return { icon: "Square", tone: "text-muted-foreground", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        str(d.service),
        " stopped in ",
        w
      ] }) };
    case "service.failed":
      return { icon: "CircleAlert", tone: "text-destructive", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        str(d.service),
        " failed to start in ",
        w
      ] }) };
    case "box.connected":
      return { icon: "Plug", tone: "text-success", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Connected to ",
        e.box
      ] }) };
    case "box.disconnected":
      return { icon: "Unplug", tone: "text-warning", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Lost ",
        e.box
      ] }) };
    case "share.started":
      return { icon: "Globe", tone: "text-warning", text: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Port ",
        str(d.port),
        " shared publicly at ",
        str(d.url)
      ] }) };
  }
  return { icon: "Dot", tone: "text-muted-foreground", text: e.type };
}
function clock(iso) {
  const d = new Date(iso);
  const today = (/* @__PURE__ */ new Date()).toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
function ActivityScreen({ berth }) {
  const all = useLog();
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [hiddenBoxes, setHiddenBoxes] = useStorage("hiddenBoxes", []);
  const [lastSeen, setLastSeen] = useStorage("lastSeen", "");
  const [mark] = useState(lastSeen);
  useEffect(() => () => setLastSeen((/* @__PURE__ */ new Date()).toISOString()), [setLastSeen]);
  const boxes = useMemo(() => [...new Set(all.map((e) => e.box).filter(Boolean))].sort(), [all]);
  const hidden = useMemo(() => new Set(boxes.every((b) => hiddenBoxes.includes(b)) ? [] : hiddenBoxes), [boxes, hiddenBoxes]);
  const [names, setNames] = useState(/* @__PURE__ */ new Map());
  const boxKey = boxes.join(",");
  useEffect(() => {
    let live = true;
    void Promise.all(
      boxes.map(
        (b) => berth.api.locations(b).then(
          (locs) => locs.flatMap((l) => (l.worktrees ?? []).map((w) => [`${b}:${w.path}`, w.main ? l.name : `${l.name}/${w.name}`])),
          () => []
        )
      )
    ).then((pairs) => live && setNames(new Map(pairs.flat())));
    return () => {
      live = false;
    };
  }, [boxKey, berth]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((e) => (kind === "all" || kindOf(e.type) === kind) && (!e.box || !hidden.has(e.box)) && (!q || `${e.type} ${where(e, names)} ${JSON.stringify(e.data ?? {})}`.toLowerCase().includes(q)));
  }, [all, kind, hidden, query, names]);
  const unseen = mark ? shown.filter((e) => e.time > mark).length : 0;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(
      ViewHeader,
      {
        title: "Activity",
        description: /* @__PURE__ */ jsxs(Fragment, { children: [
          "What agents, worktrees and flows did on every box",
          unseen > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
            ", with ",
            /* @__PURE__ */ jsxs("b", { className: "font-medium text-foreground", children: [
              unseen,
              " new"
            ] }),
            " since you last looked"
          ] }) : null,
          "."
        ] }),
        actions: /* @__PURE__ */ jsx(Input, { className: "w-52", size: "sm", placeholder: "Search\u2026", value: query, onChange: (e) => setQuery(e.target.value) })
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsx(
        PickOne,
        {
          label: "Kind of event",
          value: kind,
          onChange: (v) => setKind(v),
          options: [
            { value: "all", label: "All" },
            { value: "agents", label: "Agents" },
            { value: "worktrees", label: "Worktrees" },
            { value: "flows", label: "Flows" },
            { value: "boxes", label: "Boxes" }
          ]
        }
      ),
      /* @__PURE__ */ jsx(BoxFilter, { className: "ml-auto", boxes, hidden: hiddenBoxes, onChange: setHiddenBoxes })
    ] }),
    shown.length === 0 ? /* @__PURE__ */ jsx(Empty, { className: "rounded-xl border py-16", children: /* @__PURE__ */ jsxs(EmptyHeader, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "History", className: "mx-auto mb-2 size-5 text-muted-foreground" }),
      /* @__PURE__ */ jsx(EmptyTitle, { children: all.length ? "Nothing matches" : "Nothing has happened yet" }),
      /* @__PURE__ */ jsx(EmptyDescription, { children: all.length ? "Try another filter." : "Agents finishing, worktrees appearing and flows running will show up here as they happen." })
    ] }) }) : /* @__PURE__ */ jsx("ol", { className: "overflow-hidden rounded-xl border", children: shown.map((e, i) => {
      const line = describe(e, names);
      const divider = mark && i > 0 && shown[i - 1].time > mark && e.time <= mark;
      const session = str(e.data?.session ?? (e.type.startsWith("session.") ? e.data?.name : ""));
      return /* @__PURE__ */ jsxs("li", { children: [
        divider && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 bg-muted/60 px-4 py-1 text-muted-foreground text-xs", children: [
          /* @__PURE__ */ jsx("span", { className: "h-px flex-1 bg-border" }),
          " Since you were last here ",
          /* @__PURE__ */ jsx("span", { className: "h-px flex-1 bg-border" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: cn("group flex min-h-row items-center gap-3 border-b px-4 py-1 text-sm last:border-b-0", i === 0 && "border-t-0"), children: [
          /* @__PURE__ */ jsx(Icon, { name: line.icon, className: cn("size-4 shrink-0", line.tone) }),
          /* @__PURE__ */ jsx("span", { className: "min-w-0 flex-1 truncate text-muted-foreground", children: line.text }),
          e.box && /* @__PURE__ */ jsx(Badge, { variant: "outline", size: "sm", className: "shrink-0", children: e.box }),
          /* @__PURE__ */ jsx("span", { className: "flex w-14 shrink-0 justify-end", children: session && e.box && e.type !== "session.stopped" && /* @__PURE__ */ jsx(Button, { size: "xs", variant: "ghost", className: "opacity-0 focus-visible:opacity-100 group-hover:opacity-100", onClick: () => berth.openTerminal(e.box, session), children: "Open" }) }),
          /* @__PURE__ */ jsx("time", { className: "w-24 shrink-0 text-right text-muted-foreground text-xs tabular-nums", dateTime: e.time, children: clock(e.time) })
        ] })
      ] }, `${e.time}-${i}`);
    }) })
  ] });
}
export {
  index_default as default
};
