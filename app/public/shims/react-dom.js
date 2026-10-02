// The app's own react-dom, shared with plugins. See src/plugins/host.ts.
const ReactDOM = globalThis.__berth.ReactDOM;
export default ReactDOM;
export const { createPortal, flushSync, preconnect, prefetchDNS, preinit, preinitModule, preload, preloadModule, version } = ReactDOM;
