// ../plugins/dev-servers/src/index.tsx
import { definePlugin, useBoxes, useCurrentWorktree, useEvent } from "@berth/plugin";
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
  cn
} from "@berth/plugin/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var index_default = definePlugin((berth) => {
  berth.addScreen({ id: "servers", title: "Dev servers", Component: ServersScreen });
  berth.addSidebarItem({ id: "servers", title: "Dev servers", icon: "Radio", screen: "servers" });
  berth.addStatusBarItem({ id: "servers", Component: ServersStatus });
  berth.addCommand({ id: "servers", title: "Show dev servers", group: "Dev servers", run: () => berth.openScreen("servers") });
});
function useServers(berth) {
  const boxes = useBoxes();
  const online = useMemo(() => boxes.filter((b) => b.state === "online").map((b) => b.name), [boxes]);
  const key = online.join(",");
  const [listening, setListening] = useState();
  const [configured, setConfigured] = useState([]);
  const [stamp, setStamp] = useState(0);
  const reload = useCallback(() => setStamp((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    const load = async () => {
      const all = await Promise.all(
        online.map(
          (box) => berth.api.services(box).then(
            (s) => s.map((x) => ({ ...x, box, url: berth.api.serviceUrl(box, x.port) })),
            () => []
          )
        )
      );
      if (live) setListening(all.flat());
    };
    void load();
    const t = setInterval(load, 1e4);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [key, stamp, berth]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const found = [];
      await Promise.all(
        online.map(async (box) => {
          const locs = await berth.api.locations(box).catch(() => []);
          await Promise.all(
            locs.flatMap(
              (l) => (l.worktrees ?? []).map(async (w) => {
                const svcs = await berth.api.request(box, "GET", `locations/${encodeURIComponent(l.name)}/worktrees/${encodeURIComponent(w.name)}/services`).catch(() => []);
                for (const s of svcs ?? []) found.push({ ...s, box, location: l.name, worktree: w.name });
              })
            )
          );
        })
      );
      if (live) setConfigured(found);
    })();
    return () => {
      live = false;
    };
  }, [key, stamp, berth]);
  useEvent("service.*", reload);
  useEvent("worktree.created", reload);
  useEvent("worktree.removed", reload);
  return { listening, configured, reload };
}
function ServersStatus({ berth }) {
  const { listening } = useServers(berth);
  if (!listening?.length) return null;
  return /* @__PURE__ */ jsxs("button", { type: "button", className: "flex items-center gap-1 hover:text-foreground", onClick: () => berth.openScreen("servers"), children: [
    /* @__PURE__ */ jsx(Icon, { name: "Radio", className: "size-3" }),
    listening.length,
    " ",
    listening.length === 1 ? "server" : "servers"
  ] });
}
function ServersScreen({ berth }) {
  const { listening, configured, reload } = useServers(berth);
  const current = useCurrentWorktree();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const by = /* @__PURE__ */ new Map();
    const group = (box, location, worktree, main) => {
      const key = `${box}/${location}/${worktree}`;
      let g = by.get(key);
      if (!g) by.set(key, g = { key, box, location, worktree, main, listening: [], configured: [] });
      return g;
    };
    for (const l of listening ?? []) group(l.box, l.location, l.worktree, l.main).listening.push(l);
    for (const c of configured) group(c.box, c.location, c.worktree).configured.push(c);
    const q = query.trim().toLowerCase();
    return [...by.values()].filter((g) => !q || `${g.box} ${g.location} ${g.worktree} ${g.listening.map((l) => `${l.port} ${l.process}`).join(" ")}`.toLowerCase().includes(q)).sort((a, b) => b.listening.length - a.listening.length || a.key.localeCompare(b.key));
  }, [listening, configured, query]);
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx(
      ViewHeader,
      {
        title: "Dev servers",
        description: "Everything listening in a worktree on every box, and the services each repository runs.",
        actions: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Input, { className: "w-56", size: "sm", placeholder: "Filter by worktree, port\u2026", value: query, onChange: (e) => setQuery(e.target.value) }),
          /* @__PURE__ */ jsxs(Tooltip, { children: [
            /* @__PURE__ */ jsx(TooltipTrigger, { render: /* @__PURE__ */ jsx(Button, { size: "icon-sm", variant: "ghost", onClick: reload, "aria-label": "Refresh" }), children: /* @__PURE__ */ jsx(Icon, { name: "RefreshCw", className: "size-3.5" }) }),
            /* @__PURE__ */ jsx(TooltipPopup, { children: "Refresh" })
          ] })
        ] })
      }
    ),
    !listening ? /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-24 w-full" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-24 w-full" })
    ] }) : groups.length === 0 ? /* @__PURE__ */ jsx(Empty, { className: "py-16", children: /* @__PURE__ */ jsxs(EmptyHeader, { children: [
      /* @__PURE__ */ jsx(Icon, { name: "Radio", className: "mx-auto mb-2 size-5 text-muted-foreground" }),
      /* @__PURE__ */ jsx(EmptyTitle, { children: query ? "Nothing matches" : "Nothing is listening" }),
      /* @__PURE__ */ jsx(EmptyDescription, { children: query ? "Try another worktree or port." : /* @__PURE__ */ jsxs(Fragment, { children: [
        "Start a dev server in a worktree, or declare one under ",
        /* @__PURE__ */ jsx("code", { children: "services" }),
        " in the repository's .berth/config.json, and it shows up here."
      ] }) })
    ] }) }) : groups.map((g) => /* @__PURE__ */ jsx(WorktreeGroup, { group: g, berth, here: current?.box === g.box && current.location === g.location && current.worktree === g.worktree, onChanged: reload }, g.key))
  ] });
}
function WorktreeGroup({ group: g, berth, here, onChanged }) {
  const listeningPorts = new Set(g.listening.map((l) => l.port));
  return /* @__PURE__ */ jsxs(Frame, { variant: "card", children: [
    /* @__PURE__ */ jsxs(FrameHeader, { className: "flex-row items-center gap-2 py-2.5", children: [
      /* @__PURE__ */ jsx(Icon, { name: "GitBranch", className: "size-3.5 text-muted-foreground" }),
      /* @__PURE__ */ jsx(FrameTitle, { className: "truncate", children: g.worktree }),
      /* @__PURE__ */ jsx("span", { className: "truncate text-muted-foreground text-xs", children: g.main ? g.box : `${g.location} \xB7 ${g.box}` }),
      g.main && /* @__PURE__ */ jsx(Badge, { variant: "outline", size: "sm", children: "main checkout" }),
      here && /* @__PURE__ */ jsx(Badge, { variant: "secondary", size: "sm", children: "current worktree" })
    ] }),
    /* @__PURE__ */ jsx(FramePanel, { className: "p-0", children: /* @__PURE__ */ jsxs("ul", { className: "divide-y", children: [
      g.listening.map((l) => /* @__PURE__ */ jsx(ServerRow, { item: l, berth, service: g.configured.find((c) => c.state === "running" && c.port === l.port), onChanged }, `l${l.port}`)),
      g.configured.filter((c) => !(c.state === "running" && c.port && listeningPorts.has(c.port))).map((c) => /* @__PURE__ */ jsx(ConfiguredRow, { item: c, berth, onChanged }, `c${c.name}`))
    ] }) })
  ] });
}
function ServerRow({ item: l, berth, service, onChanged }) {
  const [copied, setCopied] = useState(false);
  const worktree = { box: l.box, location: l.location, worktree: l.worktree, path: l.path, main: l.main };
  const openInTab = (split) => {
    berth.openWorktree(worktree);
    berth.openBrowser(l.url, split ? { split } : void 0);
  };
  const stop = async () => {
    if (!service) return;
    await berth.api.request(service.box, "POST", `locations/${encodeURIComponent(service.location)}/worktrees/${encodeURIComponent(service.worktree)}/services/${encodeURIComponent(service.name)}/stop`).catch((err) => berth.notify(`Couldn't stop ${service.name}`, String(err.message ?? err)));
    onChanged();
  };
  return /* @__PURE__ */ jsxs("li", { className: "group flex items-center gap-3 px-4 py-2 text-sm", children: [
    /* @__PURE__ */ jsx("span", { className: "size-2 shrink-0 rounded-full bg-success", "aria-label": "listening" }),
    /* @__PURE__ */ jsx("span", { className: "w-14 shrink-0 font-mono tabular-nums", children: l.port }),
    /* @__PURE__ */ jsxs("span", { className: "min-w-0 flex-1 truncate", children: [
      service && /* @__PURE__ */ jsx("span", { className: "mr-2 font-medium", children: service.name }),
      /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: l.process ?? "listening" }),
      /* @__PURE__ */ jsx("span", { className: "ml-2 font-mono text-muted-foreground/70 text-xs", children: l.url.replace(/^https?:\/\//, "") })
    ] }),
    copied && /* @__PURE__ */ jsx("span", { className: "text-muted-foreground text-xs", children: "Copied" }),
    /* @__PURE__ */ jsxs(Button, { size: "xs", variant: "outline", onClick: () => openInTab(), children: [
      /* @__PURE__ */ jsx(Icon, { name: "AppWindow", className: "size-3.5" }),
      " Open in tab"
    ] }),
    /* @__PURE__ */ jsxs(Menu, { children: [
      /* @__PURE__ */ jsx(MenuTrigger, { render: /* @__PURE__ */ jsx(Button, { size: "icon-xs", variant: "ghost", "aria-label": `More for port ${l.port}` }), children: /* @__PURE__ */ jsx(Icon, { name: "Ellipsis", className: "size-3.5" }) }),
      /* @__PURE__ */ jsxs(MenuPopup, { align: "end", className: "min-w-52", children: [
        /* @__PURE__ */ jsxs(MenuItem, { onClick: () => openInTab("row"), children: [
          /* @__PURE__ */ jsx(Icon, { name: "PanelRight" }),
          " Open beside the terminal"
        ] }),
        /* @__PURE__ */ jsxs(MenuItem, { onClick: () => berth.openUrl(l.url), children: [
          /* @__PURE__ */ jsx(Icon, { name: "ArrowUpRight" }),
          " Open in your browser"
        ] }),
        /* @__PURE__ */ jsxs(
          MenuItem,
          {
            onClick: () => void navigator.clipboard?.writeText(l.url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }),
            children: [
              /* @__PURE__ */ jsx(Icon, { name: "Copy" }),
              " Copy URL"
            ]
          }
        ),
        service && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(MenuSeparator, {}),
          /* @__PURE__ */ jsxs(MenuItem, { onClick: () => void stop(), children: [
            /* @__PURE__ */ jsx(Icon, { name: "Square" }),
            " Stop ",
            service.name
          ] })
        ] })
      ] })
    ] })
  ] });
}
function ConfiguredRow({ item: c, berth, onChanged }) {
  const [busy, setBusy] = useState(false);
  const running = c.state === "running";
  const act = async (action) => {
    setBusy(true);
    try {
      await berth.api.request(c.box, "POST", `locations/${encodeURIComponent(c.location)}/worktrees/${encodeURIComponent(c.worktree)}/services/${encodeURIComponent(c.name)}/${action}`);
      onChanged();
    } catch (err) {
      berth.notify(`Couldn't ${action} ${c.name}`, String(err.message ?? err));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-3 px-4 py-2 text-sm", children: [
    /* @__PURE__ */ jsx("span", { className: cn("size-2 shrink-0 rounded-full", running ? "bg-warning" : c.state === "failed" ? "bg-destructive" : "bg-muted-foreground/30"), "aria-label": c.state }),
    /* @__PURE__ */ jsx("span", { className: "w-14 shrink-0 font-medium", children: c.name }),
    /* @__PURE__ */ jsx("span", { className: "min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs", title: c.run, children: c.run }),
    /* @__PURE__ */ jsx("span", { className: "text-muted-foreground text-xs", children: running ? "running, not listening yet" : c.state }),
    running ? /* @__PURE__ */ jsx(Button, { size: "xs", variant: "outline", loading: busy, onClick: () => void act("stop"), children: "Stop" }) : /* @__PURE__ */ jsx(Button, { size: "xs", loading: busy, onClick: () => void act("start"), children: "Start" })
  ] });
}
export {
  index_default as default
};
