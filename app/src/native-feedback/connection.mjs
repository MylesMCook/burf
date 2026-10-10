export function trustedWindow(scope, marker) {
  if (!scope || scope.top !== scope.self || !scope.location) return false;
  const location = scope.location;
  const port = location.port ?? (location.host?.match(/:(\d+)$/)?.[1] ?? "");
  const hostname = location.hostname ?? location.host?.replace(/:\d+$/, "");
  const validPort = port === "" || (/^\d+$/.test(port) && Number(port) >= 1024 && Number(port) <= 65535);
  const nativeOrigin = validPort && ((location.protocol === "http:" && hostname === "wails.localhost") || (location.protocol === "wails:" && hostname === "localhost"));
  return nativeOrigin && (marker === null || scope[marker] === true);
}

export function endpointFrom(value) {
  if (!value || typeof value !== "object" || typeof value.endpoint !== "string") throw new Error("Feedback configuration is unavailable.");
  const url = new URL(value.endpoint);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || Number(url.port) < 1024 ||
      url.username || url.password || url.search || url.hash || !/^\/[a-f0-9]{32}$/.test(url.pathname)) throw new Error("Feedback endpoint is invalid.");
  return value.endpoint;
}
