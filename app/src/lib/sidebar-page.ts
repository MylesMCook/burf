// Show long sidebar lists in batches without losing the selected row or
// its ancestors. Callers supply the rows that must remain reachable.
export const SIDEBAR_PAGE = 12;

// JSON tuples keep box, section, project and session scopes distinct even
// when their identifiers contain the separators used in display labels.
export const sidebarPageKey = (...parts: string[]): string => JSON.stringify(parts);

export function sidebarPage<T>(rows: readonly T[], limit: number, pinned: (row: T) => boolean): T[] {
  return rows.filter((row, index) => index < limit || pinned(row));
}
