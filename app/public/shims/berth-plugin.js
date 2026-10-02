// The plugin SDK's runtime half, provided by the app. See src/plugins/host.ts.
const sdk = globalThis.__berth.sdk;
export default sdk;
export const { definePlugin, useBerth, useBoxes, useLocations, useSessions, useStats, useEvent, useCurrentWorktree, useStorage, useProjects, worktreeLocation } = sdk;
