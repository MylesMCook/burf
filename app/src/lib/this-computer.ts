// thisComputerName is the hostname on the sidebar row. Native local
// sessions name it (Windows and macOS). A laptop still has a name from
// the local box, and the row is that computer when native sessions are not.
export function thisComputerName(local: { supported: boolean; name: string } | undefined, boxName: string | undefined): string | undefined {
  if (local?.supported && local.name) return local.name;
  if (boxName) return boxName;
  return undefined;
}

// A local messaging choice never starts remote-box setup. Pending capability
// discovery opens the local view, where a failed or unsupported API is reported.
// Older clients with an existing local box keep their worktree access.
export function thisComputerTarget(supported: boolean | undefined, box: string | undefined): { kind: "local" } | { kind: "worktrees"; box: string } {
  return supported === false && box ? { kind: "worktrees", box } : { kind: "local" };
}
