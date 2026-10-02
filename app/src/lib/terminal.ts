import type { TerminalColors } from "@/lib/api";

// One small interface over the terminal emulator, so the renderer can be
// swapped: ghostty-web (Ghostty's VT parser in WASM, drawn on a canvas) by
// default, xterm.js as the fallback. Both are loaded on demand.

export type Renderer = "ghostty" | "xterm";

export interface TerminalPrefs {
  renderer: Renderer;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: "block" | "bar" | "underline";
  cursorBlink: boolean;
  scrollback: number;
}

export const DEFAULT_TERMINAL_PREFS: TerminalPrefs = {
  renderer: "ghostty",
  fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, monospace',
  fontSize: 13,
  lineHeight: 1.1,
  cursorStyle: "block",
  cursorBlink: true,
  scrollback: 10000,
};

export interface TermHandle {
  readonly cols: number;
  readonly rows: number;
  write(data: string | Uint8Array): void;
  reset(): void;
  fit(): void;
  focus(): void;
  setTheme(colors: TerminalColors): void;
  onData(fn: (data: string) => void): void;
  onResize(fn: (size: { cols: number; rows: number }) => void): void;
  hasSelection(): boolean;
  // Adds links found in each line's text, such as file paths. find gets a
  // line and returns ranges in it (end exclusive).
  registerLinkFinder(find: LinkFinder): void;
  dispose(): void;
}

export interface FoundLink {
  start: number;
  end: number;
  activate(event: MouseEvent): void;
}

export type LinkFinder = (line: string) => FoundLink[];

const theme = (c: TerminalColors) => ({ ...c, cursorAccent: c.background });

let ghosttyReady: Promise<typeof import("ghostty-web")> | undefined;

// ghostty-web needs its WASM initialised once before the first terminal.
function loadGhostty() {
  ghosttyReady ??= import("ghostty-web").then(async (m) => {
    await m.init();
    return m;
  });
  return ghosttyReady;
}

export async function createTerminal(host: HTMLElement, colors: TerminalColors, prefs: TerminalPrefs): Promise<TermHandle> {
  await document.fonts.load(`${prefs.fontSize}px ${prefs.fontFamily}`).catch(() => {});
  if (prefs.renderer === "xterm") return createXterm(host, colors, prefs);
  try {
    return await createGhostty(host, colors, prefs);
  } catch (err) {
    console.error("ghostty-web failed to start; using xterm.js", err);
    return createXterm(host, colors, prefs);
  }
}

async function createGhostty(host: HTMLElement, colors: TerminalColors, prefs: TerminalPrefs): Promise<TermHandle> {
  const g = await loadGhostty();
  const t = new g.Terminal({
    fontFamily: prefs.fontFamily,
    fontSize: prefs.fontSize,
    cursorStyle: prefs.cursorStyle,
    cursorBlink: prefs.cursorBlink,
    scrollback: prefs.scrollback,
    theme: theme(colors),
  });
  const fit = new g.FitAddon();
  t.loadAddon(fit);
  t.open(host);
  return {
    get cols() {
      return t.cols;
    },
    get rows() {
      return t.rows;
    },
    write: (d) => t.write(d),
    reset: () => t.reset(),
    fit: () => {
      try {
        fit.fit();
      } catch {
        // Not laid out yet.
      }
    },
    focus: () => t.focus(),
    setTheme: (c) => {
      t.options.theme = theme(c);
    },
    onData: (fn) => void t.onData(fn),
    onResize: (fn) => void t.onResize(fn),
    hasSelection: () => t.hasSelection(),
    registerLinkFinder: (find) =>
      t.registerLinkProvider({
        provideLinks(y, callback) {
          const text = t.buffer.active.getLine(y)?.translateToString(true) ?? "";
          const links = find(text).map((l) => ({
            text: text.slice(l.start, l.end),
            range: { start: { x: l.start, y }, end: { x: l.end - 1, y } },
            activate: (e: MouseEvent) => l.activate(e),
          }));
          callback(links.length ? links : undefined);
        },
      }),
    dispose: () => t.dispose(),
  };
}

async function createXterm(host: HTMLElement, colors: TerminalColors, prefs: TerminalPrefs): Promise<TermHandle> {
  const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
    import("@xterm/addon-web-links"),
    import("@xterm/xterm/css/xterm.css"),
  ]);
  const { openUrl } = await import("@/lib/open-url");
  const t = new Terminal({
    fontFamily: prefs.fontFamily,
    fontSize: prefs.fontSize,
    lineHeight: prefs.lineHeight,
    letterSpacing: 0,
    cursorStyle: prefs.cursorStyle,
    cursorInactiveStyle: "outline",
    cursorBlink: prefs.cursorBlink,
    scrollback: prefs.scrollback,
    minimumContrastRatio: 4.5,
    macOptionIsMeta: true,
    allowProposedApi: true,
    theme: theme(colors),
  });
  const fit = new FitAddon();
  t.loadAddon(fit);
  t.loadAddon(new WebLinksAddon((_e, uri) => void openUrl(uri)));
  t.open(host);
  return {
    get cols() {
      return t.cols;
    },
    get rows() {
      return t.rows;
    },
    write: (d) => t.write(d),
    reset: () => t.reset(),
    fit: () => {
      try {
        fit.fit();
      } catch {
        // Not laid out yet.
      }
    },
    focus: () => t.focus(),
    setTheme: (c) => {
      t.options.theme = theme(c);
    },
    onData: (fn) => void t.onData(fn),
    onResize: (fn) => void t.onResize(fn),
    hasSelection: () => t.hasSelection(),
    registerLinkFinder: (find) =>
      void t.registerLinkProvider({
        provideLinks(y, callback) {
          const text = t.buffer.active.getLine(y - 1)?.translateToString(true) ?? "";
          const links = find(text).map((l) => ({
            text: text.slice(l.start, l.end),
            range: { start: { x: l.start + 1, y }, end: { x: l.end, y } },
            activate: (e: MouseEvent) => l.activate(e),
          }));
          callback(links.length ? links : undefined);
        },
      }),
    dispose: () => t.dispose(),
  };
}
