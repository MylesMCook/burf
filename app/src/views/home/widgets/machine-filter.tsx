import * as stylex from "@stylexjs/stylex";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { BoxFilter, shownBoxes } from "@/components/box-filter";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectGroup, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllSessions } from "@/hooks/use-agent-counts";
import { agentLabel, agentOf, worktreeOf } from "@/lib/derive";
import { load, save } from "@/lib/storage";
import { NONE, useStore } from "@/lib/store";
import { activityFilter, activityFiltered, ALL_ACTIVITY, matchesActivity, projectKey, type ActivityFilter } from "./activity-filter";

const KEY = "berth.home.hiddenMachines";
const ACTIVITY_KEY = "berth.home.activityFilters";
const MachineContext = createContext<readonly string[] | undefined>(undefined);
const ActivityContext = createContext({ filter: ALL_ACTIVITY, now: Date.now() });
const ControlsContext = createContext<ReactNode>(null);
const styles = stylex.create({
  filters: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, minWidth: 0 },
  facets: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 8, minWidth: 0 },
  facet: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0, maxWidth: 224 },
  label: { color: "var(--muted-foreground)", fontSize: 12 },
  hint: { color: "var(--muted-foreground)", fontSize: 12, maxWidth: 680, overflowWrap: "anywhere" },
});

export const useHomeMachines = () => useContext(MachineContext);
export const useHomeActivity = () => useContext(ActivityContext);
export const HomeMachineFilter = () => useContext(ControlsContext);

const windows = [{ value: "all", label: "Any time" }, { value: "hour", label: "Last hour" }, { value: "day", label: "Last 24 hours" }, { value: "week", label: "Last 7 days" }];
const states = [{ value: "all", label: "All states" }, { value: "waiting", label: "Needs you" }, { value: "running", label: "Working" }, { value: "finished", label: "Finished" }];
function Facet({ label, value, items, onChange }: { label: string; value: string; items: { value: string; label: string }[]; onChange(value: string): void }) {
  return <div {...stylex.props(styles.facet)}>
    <span {...stylex.props(styles.label)}>{label}</span>
    <Select value={value} items={items} onValueChange={(next) => { if (next !== null) onChange(next); }}>
      <SelectTrigger size="sm" measure="grow" aria-label={`Home activity ${label.toLowerCase()}`}><SelectValue /></SelectTrigger>
      <SelectPopup><SelectGroup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectPopup>
    </Select>
  </div>;
}

export function HomeMachineScope({ children }: { children: ReactNode }) {
  const paired = useStore((s) => s.status?.boxes ?? NONE);
  const data = useStore((s) => s.boxes);
  const all = useAllSessions();
  const boxes = paired.map((box) => box.name);
  const [hidden, setHidden] = useState<string[]>(() => {
    const saved = load<unknown>(KEY, []);
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
  });
  const [filter, setFilter] = useState(() => activityFilter(load<unknown>(ACTIVITY_KEY, ALL_ACTIVITY)));
  const [filtersOpen, setFiltersOpen] = useState(() => activityFiltered(filter));
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (filter.window === "all") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [filter.window]);
  const selected = shownBoxes(boxes, hidden);
  const candidates = all.flatMap((entry) => {
    const provider = agentOf(entry.session);
    if (!provider || !["waiting", "running", "finished"].includes(entry.state) || !selected.includes(entry.box)) return [];
    const worktree = worktreeOf(data[entry.box]?.locations, entry.session);
    return [{ provider, state: entry.state, project: worktree ? projectKey(entry.box, worktree.location.name) : undefined, projectKnown: data[entry.box]?.locations !== undefined, since: entry.session.state_since ?? entry.session.created }];
  });
  const providers = [{ value: "", label: "All providers" }, ...[...new Set(candidates.map((row) => row.provider))].sort().map((provider) => ({ value: provider, label: agentLabel(provider) }))];
  if (filter.provider && !providers.some((item) => item.value === filter.provider)) providers.push({ value: filter.provider, label: `${agentLabel(filter.provider)} (not reported)` });
  const projects = [{ value: "", label: "All projects" }, { value: "unassigned", label: "No project" }, ...selected.flatMap((box) => (data[box]?.locations ?? []).map((location) => ({ value: projectKey(box, location.name), label: `${location.name} · ${box}` })))];
  if (filter.project && !projects.some((item) => item.value === filter.project)) projects.push({ value: filter.project, label: "Saved project (not reported)" });
  const change = (next: ActivityFilter) => { setFilter(next); save(ACTIVITY_KEY, next); };
  const active = activityFiltered(filter);
  const summary = [
    filter.window !== "all" && windows.find((item) => item.value === filter.window)?.label,
    filter.state !== "all" && states.find((item) => item.value === filter.state)?.label,
    filter.provider && providers.find((item) => item.value === filter.provider)?.label,
    filter.project && projects.find((item) => item.value === filter.project)?.label,
  ].filter(Boolean).join(" · ");
  const matches = candidates.filter((row) => matchesActivity(row, filter, now)).length;
  const controls = <div data-testid="home-filters" {...stylex.props(styles.filters)}>
    <BoxFilter boxes={boxes} hidden={hidden} label="Machines for Home activity" onChange={(next) => { setHidden(next); save(KEY, next); }} />
    <Collapsible width="full" open={filtersOpen} onOpenChange={setFiltersOpen}>
    <CollapsibleTrigger render={<Button size="sm" variant="ghost" aria-label={`Activity filters${summary ? `: ${summary}` : ""}`} />}>Filters{summary ? ` · ${summary}` : ""}</CollapsibleTrigger>
    <CollapsiblePanel keepMounted>
    <div {...stylex.props(styles.facets)}>
      <Facet label="State changed" value={filter.window} items={windows} onChange={(value) => change({ ...filter, window: activityFilter({ window: value }).window })} />
      <Facet label="State" value={filter.state} items={states} onChange={(value) => change({ ...filter, state: activityFilter({ state: value }).state })} />
      <Facet label="Provider" value={filter.provider} items={providers} onChange={(provider) => change({ ...filter, provider })} />
      <Facet label="Project" value={filter.project} items={projects} onChange={(project) => change({ ...filter, project })} />
    </div>
    <p {...stylex.props(styles.hint)}>Activity filters: Needs you, Working now and Recently finished. Computer choices also cover Recent areas, Computers and Dev servers. Plugin widgets keep their own scope.</p>
    </CollapsiblePanel>
    </Collapsible>
    {active && <Button size="sm" variant="outline" onClick={() => change(ALL_ACTIVITY)}>Reset activity filters</Button>}
    {active && <p role="status" {...stylex.props(styles.hint)}>{matches ? `${matches} of ${candidates.length} known agent tasks match.` : "No matching agent activity. Reset activity filters to show all known tasks."}</p>}
  </div>;
  const activity = useMemo(() => ({ filter, now }), [filter, now]);
  return <MachineContext.Provider value={selected}><ActivityContext.Provider value={activity}><ControlsContext.Provider value={controls}>{children}</ControlsContext.Provider></ActivityContext.Provider></MachineContext.Provider>;
}
