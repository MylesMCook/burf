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
  // Types text as a paste: bracketed when the program asked for that, as
  // Claude Code does, so it sees a pasted image's path as an image.
  paste(text: string): void;
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

// ghostty-web is loaded once; each terminal then loads its own WASM
// instance (see createGhostty), so its shared one (init()) is never made.
function loadGhostty() {
  ghosttyReady ??= import("ghostty-web");
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

// The parts of ghostty-web's renderer keepLastColumn reaches into.
interface GhosttyRenderer {
  render(buffer: unknown, full?: boolean, viewportY?: number, term?: unknown, scrollbarOpacity?: number): void;
  renderScrollbar(viewportY: number, scrollback: number, rows: number, opacity?: number): void;
}

// keepLastColumn works around ghostty-web 0.4 painting its scrollbar over the
// terminal's last columns. Its scrollbar is an overlay inside the canvas, and
// drawing it first fills a 14px strip at the right edge with the background.
// Terminal.resize renders without passing the scrollbar's opacity, so after
// every fit (a pane split, a window resize) that strip was blanked even with
// no scrollbar showing, and stayed blank on every row that did not change:
// the last column or two of the text went missing. The same happened after
// the scrollbar faded out. Here the strip is only painted while the
// scrollbar shows, and the whole screen is redrawn once it is gone.
function keepLastColumn(t: object) {
  const r = (t as { renderer?: Partial<GhosttyRenderer> }).renderer;
  if (typeof r?.render !== "function" || typeof r.renderScrollbar !== "function") return;
  const render = r.render.bind(r);
  const renderScrollbar = r.renderScrollbar.bind(r);
  let barDrawn = false;
  r.renderScrollbar = (viewportY, scrollback, rows, opacity = 1) => {
    if (opacity <= 0 || scrollback === 0) return;
    barDrawn = true;
    renderScrollbar(viewportY, scrollback, rows, opacity);
  };
  r.render = (buffer, full = false, viewportY = 0, term, opacity) => {
    const shown = opacity ?? (term as { scrollbarOpacity?: number } | undefined)?.scrollbarOpacity ?? 0;
    // The bar was drawn over the text and is now gone: put the text back.
    if (barDrawn && shown <= 0) {
      barDrawn = false;
      full = true;
    }
    render(buffer, full, viewportY, term, shown);
  };
}

// Each terminal gets a WASM instance of its own, and reset() clears it in
// place. ghostty-web 0.4 shares one instance (one WASM heap) between every
// terminal, and its reset() frees the terminal and makes a new one. Ghostty
// assumes new page memory is zeroed, which holds for the OS's pages but not
// for WASM memory freed by another terminal (or by reset) and handed out
// again. A terminal made in reused memory looked fine until it grew wider:
// widening a page only bumps its width, so the cells past the old width
// showed whatever the previous owner left there (replacement characters,
// CJK and Arabic glyphs) when a split partner closed or the window grew.
// A fresh instance starts with zeroed memory, and RIS (ESC c) plus erasing
// the scrollback resets without freeing anything. Loading one takes ~5ms.
async function createGhostty(host: HTMLElement, colors: TerminalColors, prefs: TerminalPrefs): Promise<TermHandle> {
  const g = await loadGhostty();
  const ghostty = await g.Ghostty.load();
  const t = new g.Terminal({
    ghostty,
    fontFamily: prefs.fontFamily,
    fontSize: prefs.fontSize,
    cursorStyle: prefs.cursorStyle,
    cursorBlink: prefs.cursorBlink,
    scrollback: prefs.scrollback,
    theme: theme(colors),
  });
  const fit = new g.FitAddon();
  t.loadAddon(fit);
  // ghostty-web focuses itself on open, once at once and again a tick later
  // (a setTimeout), so putting focus back afterwards lost to the second one:
  // a split an agent opened beside you took the keyboard while the pane you
  // were in still looked focused. Its focus is switched off while it opens.
  // Whoever has the keyboard keeps it; the pane focuses its terminal itself
  // when it should (TerminalView).
  t.focus = () => {};
  try {
    t.open(host);
  } finally {
    delete (t as { focus?: unknown }).focus;
  }
  keepLastColumn(t);
  // Output still on its way when the terminal is replaced (a new font size,
  // ⌘+) is dropped: ghostty-web throws on a write after dispose.
  let disposed = false;
  return {
    get cols() {
      return t.cols;
    },
    get rows() {
      return t.rows;
    },
    write: (d) => void (disposed || t.write(d)),
    // Full reset, then erase the scrollback: see createGhostty.
    reset: () => void (disposed || t.write("\x1bc\x1b[3J")),
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
    paste: (text) => t.paste(text),
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
    dispose: () => {
      disposed = true;
      t.dispose();
    },
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
    paste: (text) => t.paste(text),
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
