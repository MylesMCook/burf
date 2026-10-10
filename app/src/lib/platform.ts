// Native Windows and Mac keep their own shortcuts; Linux is an alpha.
// ?platform=mac/windows/linux can show a platform in screenshots and tests.
import { isDesktop } from "./desktop.ts";

const forced = (() => {
  try {
    return new URLSearchParams(location.search).get("platform");
  } catch {
    return null;
  }
})();

const native = isDesktop();
const nav = typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent;

export const IS_LINUX = forced ? forced === "linux" : native && /Linux/.test(nav);
export const IS_MAC = forced ? forced === "mac" : /Mac|iPhone|iPad/.test(nav);
export const IS_WINDOWS = forced ? forced === "windows" : /Win/.test(nav);

export const isMac = (): boolean => IS_MAC;
export const isWindows = (): boolean => IS_WINDOWS;

export function primaryModifier(e: { metaKey: boolean; ctrlKey: boolean }, mac = IS_MAC): boolean {
  return mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
}

// The Linux app is an alpha: it says so beside its name.
export const LINUX_ALPHA = IS_LINUX;

export const LINUX_BUGS = "https://github.com/MylesMCook/burf/issues/new?labels=linux&title=Linux%3A+";

// How the Linux app's keys meet a terminal's (hooks/use-shortcuts.ts).
export const LINUX_TERMINAL_KEYS =
  "Ctrl stands in for ⌘. In a terminal, Ctrl and a letter go to the shell (Ctrl+W, Ctrl+D, Ctrl+K…); add Shift for the app's (Ctrl+Shift+T, Ctrl+Shift+K). Ctrl+Shift+C and Ctrl+Shift+V copy and paste there.";

// Only a Mac calls itself "this Mac"; other platforms say "this computer".
export const thisComputer = (s: string): string => (!IS_MAC ? s.replaceAll("this Mac", "this computer").replaceAll("This Mac", "This computer") : s);

// The key that stands in for ⌘: ⌘ on a Mac, Ctrl everywhere else.
export const modKey = (e: { metaKey: boolean; ctrlKey: boolean }): boolean => primaryModifier(e);

const NAMES: Record<string, string> = { "⌃": "Ctrl", "⌘": "Ctrl", "⌥": "Alt", "⇧": "Shift" };
const ORDER = ["Ctrl", "Alt", "Shift"];
const KEYS: Record<string, string> = { "↵": "Enter", "⇥": "Tab", "⌫": "Backspace" };

// platformKeys writes a key hint for this platform: as it is on a Mac
// ("⌘⇧D"), and with Ctrl, Alt and Shift elsewhere ("Ctrl+Shift+D"), the
// keys the Linux app takes (hooks/use-shortcuts.ts).
export function platformKeys(s: string, mac = IS_MAC): string {
  if (mac || !/[⌃⌘⌥⇧]/.test(s)) return s;
  return s
    .replace(/([⌃⌘⌥⇧]+)-click/g, (_, m: string) => `${names(m).join("+")}-click`)
    .replace(/([⌃⌘⌥⇧]+) ?([^\s⌃⌘⌥⇧]+)/g, (_, m: string, key: string) => [...names(m), KEYS[key] ?? key].join("+"));
}

function names(mods: string): string[] {
  const out = new Set([...mods].map((c) => NAMES[c]).filter(Boolean));
  return ORDER.filter((n) => out.has(n));
}

// Retain the fork's existing shortcut API with the shared platform formatter.
export const shortcutLabel = platformKeys;
