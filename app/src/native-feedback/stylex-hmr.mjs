// Wails' intercepted asset responses can be slow during cold module loading.
// StyleX's async custom-event callback otherwise blocks Vite's serial HMR queue.
export function nativeStylexHMR() {
  return {
    name: "wails-native-feedback-stylex-hmr",
    enforce: "post",
    transform(code, id) {
      if (!id.includes("virtual:stylex:runtime")) return null;
      const hook = "import.meta.hot.on('stylex:css-update', update);";
      const initial = "\nupdate();";
      const delayed = "setTimeout(update, AFTER_UPDATE_DELAY)";
      const fetch = "const r = await fetch(DEV_CSS_PATH + '?t=' + t, {cache: 'no-store'});\n  return r.text();";
      const result = "const css = await fetchCSS();";
      const dispose = "import.meta.hot.dispose(() => {";
      for (const expected of [hook, initial, delayed, fetch, result, dispose]) {
        if (code.split(expected).length !== 2) throw new Error("Unsupported StyleX development runtime; native feedback requires the reviewed full runtime shape.");
      }
      const worker = `
let nativeCSSDirty = false;
let nativeCSSRunning = false;
let nativeCSSDisposed = false;
let nativeCSSController;
function requestNativeCSSUpdate() {
  if (nativeCSSDisposed) return;
  nativeCSSDirty = true;
  if (nativeCSSRunning) return;
  nativeCSSRunning = true;
  void (async () => {
    try {
      while (nativeCSSDirty && !nativeCSSDisposed) {
        nativeCSSDirty = false;
        await update();
      }
    } finally { nativeCSSRunning = false; }
  })();
}
`;
      return {
        code: worker + code
          .replace(fetch, `const controller = new AbortController();
  nativeCSSController = controller;
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(DEV_CSS_PATH + '?t=' + t, {cache: 'no-store', signal: controller.signal});
    return await r.text();
  } finally {
    clearTimeout(timeout);
    if (nativeCSSController === controller) nativeCSSController = undefined;
  }`)
          .replace(result, result + "\n    if (nativeCSSDisposed) return;")
          .replace(initial, "\nrequestNativeCSSUpdate();")
          .replace(hook, "import.meta.hot.on('stylex:css-update', requestNativeCSSUpdate);")
          .replace(delayed, "setTimeout(requestNativeCSSUpdate, AFTER_UPDATE_DELAY)")
          .replace(dispose, dispose + "\n    nativeCSSDisposed = true; nativeCSSDirty = false; nativeCSSController?.abort();"),
        map: null,
      };
    },
  };
}
