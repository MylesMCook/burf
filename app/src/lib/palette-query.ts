// A settings page name is a place to open, not a task to start.

export function isSettingsPageQuery(query: string, names: readonly string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return names.some((name) => name.toLowerCase() === q);
}
