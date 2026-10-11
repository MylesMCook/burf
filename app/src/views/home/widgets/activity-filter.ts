export type ActivityState = "all" | "waiting" | "running" | "finished";
export type ActivityWindow = "all" | "hour" | "day" | "week";
export interface ActivityFilter {
  window: ActivityWindow;
  state: ActivityState;
  provider: string;
  project: string;
}
export const ALL_ACTIVITY: ActivityFilter = { window: "all", state: "all", provider: "", project: "" };

export function activityFilter(value: unknown): ActivityFilter {
  const saved = value && typeof value === "object" ? value as Partial<ActivityFilter> : {};
  return {
    window: saved.window === "hour" || saved.window === "day" || saved.window === "week" ? saved.window : "all",
    state: saved.state === "waiting" || saved.state === "running" || saved.state === "finished" ? saved.state : "all",
    provider: typeof saved.provider === "string" ? saved.provider : "",
    project: typeof saved.project === "string" ? saved.project : "",
  };
}

export const projectKey = (box: string, project: string) => JSON.stringify([box, project]);
export const activityFiltered = (filter: ActivityFilter) => filter.window !== "all" || filter.state !== "all" || !!filter.provider || !!filter.project;

// Windows describe the last known state change, not a retained event history.
export function matchesActivity(row: { state: string; provider: string; project?: string; projectKnown?: boolean; since?: string }, filter: ActivityFilter, now: number): boolean {
  if (filter.state !== "all" && row.state !== filter.state) return false;
  if (filter.provider && row.provider !== filter.provider) return false;
  if (filter.project && (row.projectKnown === false || (row.project ?? "unassigned") !== filter.project)) return false;
  if (filter.window === "all") return true;
  const since = Date.parse(row.since ?? "");
  const duration = { hour: 3_600_000, day: 86_400_000, week: 604_800_000 }[filter.window];
  return Number.isFinite(since) && since <= now && since >= now - duration;
}
