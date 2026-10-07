export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);
export const isWindows = () => /Win/.test(navigator.platform);

export function primaryModifier(e: Pick<KeyboardEvent, "metaKey" | "ctrlKey">, mac = isMac()): boolean {
  return mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
}

export function shortcutLabel(keys: string, mac = isMac()): string {
  if (mac) return keys;
  return keys.replaceAll("⌘", "Ctrl+").replaceAll("⌥", "Alt+").replaceAll("⇧", "Shift+").replaceAll("⌃", "Ctrl+");
}
