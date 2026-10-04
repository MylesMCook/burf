import { useEffect, useState } from "react";

import { useStore } from "@/lib/store";

// The agent's browser on a box: a headless Chromium per worktree that the
// agent drives (berthd browser …). The app only watches it: its status, a
// live screencast while a pane shows it, and the shots it left for Review.

export interface AgentBrowserStatus {
  running: boolean;
  text: string;
  status?: { url?: string; rss_bytes?: number; watchers?: number };
}

export interface BrowserArtifacts {
  url?: string;
  shots?: string[];
  errors?: string[];
}

export const boxHasBrowser = (box: string) => !!useStore.getState().boxes[box]?.info?.capabilities?.includes("browser");

const base = (location: string, worktree: string) => `worktrees/${encodeURIComponent(location)}/${encodeURIComponent(worktree)}/browser`;

export function agentBrowserStatus(box: string, location: string, worktree: string): Promise<AgentBrowserStatus> {
  const c = useStore.getState().client;
  if (!c) return Promise.reject(new Error("not connected"));
  return c.box<AgentBrowserStatus>(box, "GET", `${base(location, worktree)}/status`);
}

export interface Frame {
  data: string;
  mime?: string;
  w: number;
  h: number;
  url?: string;
}

// watchAgentBrowser streams the page as JPEG frames while signal is live:
// the box casts only while someone watches.
export function watchAgentBrowser(box: string, location: string, worktree: string, onFrame: (f: Frame) => void, signal: AbortSignal): Promise<void> {
  const c = useStore.getState().client;
  if (!c) return Promise.reject(new Error("not connected"));
  return c.stream("GET", `/v1/boxes/${encodeURIComponent(box)}/api/${base(location, worktree)}/screencast`, undefined, (v) => onFrame(v as Frame), signal);
}

const shotCache = new Map<string, Promise<string>>();

// useShotUrl is an object URL for a shot the agent's browser saved.
export function useShotUrl(box: string, location: string, worktree: string, name: string): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const c = useStore.getState().client;
    if (!c) return;
    const key = `${box}/${location}/${worktree}/${name}`;
    let p = shotCache.get(key);
    if (!p) {
      p = c.boxBlob(box, `${base(location, worktree)}/shots/${encodeURIComponent(name)}`).then((b) => URL.createObjectURL(b));
      shotCache.set(key, p);
      // A small cache: shots are kept 20 per worktree on the box.
      if (shotCache.size > 60) shotCache.delete(shotCache.keys().next().value!);
    }
    let live = true;
    p.then((u) => live && setUrl(u)).catch(() => shotCache.delete(key));
    return () => {
      live = false;
    };
  }, [box, location, worktree, name]);
  return url;
}
