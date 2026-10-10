// xterm 5.5.0 leaves viewport reset callbacks queued after disposal. Stop
// those callbacks from consulting the renderer that dispose() removes.
export function disposeXterm(terminal: { dispose(): void }) {
  const core: unknown = Reflect.get(terminal, "_core");
  if (core && typeof core === "object") {
    const viewport: unknown = Reflect.get(core, "viewport");
    if (viewport && typeof viewport === "object" && typeof Reflect.get(viewport, "syncScrollArea") === "function") {
      Reflect.set(viewport, "syncScrollArea", () => {});
    }
  }
  terminal.dispose();
}
