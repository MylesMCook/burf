import type { Service } from "@berth/plugin";

// Browser panes mostly show a box's dev servers through the laptop's proxy.
// A worktree's server has a name there, <worktree>.<location>.<box>.localhost
// (the main checkout: <location>.<box>.localhost), which reaches the lowest
// port the worktree listens on; any other port is <port>.<box>.localhost.
// These are pure functions over what the store knows, so they are easy to
// check and plugins can use them too.

export interface BrowserContext {
  // The worktree the pane belongs to, when there is one.
  ref?: { box: string; location: string; worktree: string; path: string; main?: boolean };
  // The box's services (GET services), any worktree.
  services?: Service[];
  // status.proxy.url_port: 80 needs no port in URLs.
  urlPort?: number;
}

const DEFAULT_PROXY_PORT = 1377;

// A label the proxy can match: DNS lowercases names on the way, so a worktree
// called "Fix_Login" could never be reached by its name.
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function hostSuffix(urlPort?: number): string {
  const p = urlPort ?? DEFAULT_PROXY_PORT;
  return p === 80 ? "" : `:${p}`;
}

function worktreeServices(ctx: BrowserContext): Service[] {
  const ref = ctx.ref;
  if (!ref) return [];
  return (ctx.services ?? []).filter((s) => s.path === ref.path || (s.location === ref.location && s.worktree === ref.worktree));
}

// worktreeHost is the name the proxy routes to a worktree's lowest port, or
// undefined when its names cannot be hostname labels.
export function worktreeHost(ref: NonNullable<BrowserContext["ref"]>): string | undefined {
  const labels = ref.main ? [ref.location, ref.box] : [ref.worktree, ref.location, ref.box];
  return labels.every((l) => LABEL.test(l)) ? `${labels.join(".")}.localhost` : undefined;
}

// portUrl is the URL for a port on the current worktree's box: by the
// worktree's name when that is where the name leads, by number otherwise.
export function portUrl(port: number, ctx: BrowserContext): string | undefined {
  const ref = ctx.ref;
  if (!ref) return undefined;
  const suffix = hostSuffix(ctx.urlPort);
  const ports = worktreeServices(ctx).map((s) => s.port);
  const host = worktreeHost(ref);
  if (host && ports.length > 0 && port === Math.min(...ports)) return `http://${host}${suffix}/`;
  return `http://${port}.${ref.box}.localhost${suffix}/`;
}

// resolveBrowserInput turns what someone typed in a browser pane into a URL:
// a port ("3000", ":3000") is the current worktree's, berth and local names
// are http, anything else that looks like a host is https.
export function resolveBrowserInput(input: string, ctx: BrowserContext): string | undefined {
  const v = input.trim();
  if (!v) return undefined;
  const port = /^:?(\d{2,5})$/.exec(v);
  if (port) {
    const n = Number(port[1]);
    return n > 0 && n < 65536 ? portUrl(n, ctx) : undefined;
  }
  if (/^https?:\/\//i.test(v)) return v;
  if (/\s/.test(v)) return undefined;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/.*)?$/i.test(v)) return `http://${v}`;
  if (/^[\w-]+(\.[\w-]+)*\.localhost(:\d+)?(\/.*)?$/i.test(v)) return `http://${v}`;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v)) return `https://${v}`;
  return undefined;
}

export interface Suggestion {
  port: number;
  process?: string;
  url: string;
}

// suggestions lists the current worktree's dev servers, lowest port first.
export function suggestions(ctx: BrowserContext): Suggestion[] {
  return worktreeServices(ctx)
    .slice()
    .sort((a, b) => a.port - b.port)
    .flatMap((s) => {
      const url = portUrl(s.port, ctx);
      return url ? [{ port: s.port, process: s.process, url }] : [];
    });
}

export interface BerthUrl {
  box: string;
  location?: string;
  worktree?: string;
  port?: number;
}

// describeBerthUrl reads a proxy URL back into the box, worktree or port it
// reaches, for the pane's toolbar. boxes are the paired boxes' names.
export function describeBerthUrl(url: string, boxes: string[]): BerthUrl | undefined {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  if (!host.endsWith(".localhost")) return undefined;
  const l = host.slice(0, -".localhost".length).split(".");
  if (l.length === 3 && boxes.includes(l[2])) return { box: l[2], location: l[1], worktree: l[0] };
  if (l.length === 2 && boxes.includes(l[1])) {
    return /^\d+$/.test(l[0]) ? { box: l[1], port: Number(l[0]) } : { box: l[1], location: l[0] };
  }
  return undefined;
}

export function berthUrlLabel(d: BerthUrl): string {
  if (d.worktree) return `${d.box} · ${d.worktree}`;
  if (d.location) return `${d.box} · ${d.location}`;
  return `${d.box} · :${d.port}`;
}
