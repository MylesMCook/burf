// thisComputerName is the hostname on the sidebar row. Native local
// sessions name it (Windows). A Mac or Linux laptop still has a name from
// the local box, and the row is that computer when native sessions are not.
export function thisComputerName(local: { supported: boolean; name: string } | undefined, boxName: string | undefined): string | undefined {
  if (local?.supported && local.name) return local.name;
  if (boxName) return boxName;
  return undefined;
}
