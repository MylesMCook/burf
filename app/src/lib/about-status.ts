// What About states about this window: the agent it is calling, and why
// updates are not offered. Both are facts about this copy, not a fixed port
// or a guess that a desktop window is a browser tab.

export function agentEndpointLine(url: string, proxyPort?: number): string {
  let host = url.trim();
  try {
    host = new URL(host).host;
  } catch {
    host = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  return `${host} · proxy :${proxyPort ?? "-"}`;
}

export function updateUnavailableCopy(desktop: boolean): { label: string; description: string } {
  if (desktop) {
    return {
      label: "Updates come with the Burf app",
      description: "This build has no update feed.",
    };
  }
  return {
    label: "Updates come with the Burf app",
    description: "This page is running in a browser, which has nothing to update.",
  };
}
