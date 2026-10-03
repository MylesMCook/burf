// The app's own JSX runtime, shared with plugins. See src/plugins/host.ts.
const runtime = globalThis.__berth.ReactJSXRuntime;
export const { Fragment, jsx, jsxs } = runtime;
export const jsxDEV = runtime.jsx;
