import { useEffect, useRef, useState } from "react";

import { boxApi } from "@/lib/api";
import { keyOf, useConversations } from "@/lib/conversation-store";
import { useEventLog } from "@/lib/events";
import { choicesIn, type Choice } from "@/lib/screen";
import { useStore } from "@/lib/store";
import type { CrewMember, TranscriptItem } from "@/lib/transcript";

// The conversation of a session on a box that streams transcripts (its
// info lists "transcript"): GET sessions/{name}/transcript?since=N returns
// the items from index N, the index to ask from next, and the crew. A tool
// group still open is sent again, so items merge by id. It is read while a
// conversation is showing: on open, every 2s, and at once when an event
// about the session arrives; never while hidden.

export interface TranscriptResult {
  source: "claude" | "codex" | "none";
  items: TranscriptItem[];
  next: number;
  crew: CrewMember[];
  truncated?: boolean;
}

export type FeedState = "loading" | "ready" | "none" | "unsupported" | "error";

export const hasTranscripts = (box: string) => !!useStore.getState().boxes[box]?.info?.capabilities?.includes("transcript");

export function useTranscriptFeed(box: string, session: string, dir: string | undefined, enabled: boolean): FeedState {
  const client = useStore((s) => s.client);
  const supported = useStore((s) => !!s.boxes[box]?.info?.capabilities?.includes("transcript"));
  const [state, setState] = useState<FeedState>(supported ? "loading" : "unsupported");
  const next = useRef(0);
  const key = keyOf(box, session);
  // The last event about this session: agent.* and session.* carry its
  // name or its directory.
  const latest = useEventLog((s) => s.events.find((e) => e.box === box && (e.type.startsWith("agent.") || e.type.startsWith("session.")) && (e.data?.session === session || e.data?.name === session || (!!dir && e.data?.path === dir)))?.time);

  // A different session starts from the beginning.
  useEffect(() => {
    next.current = 0;
  }, [key]);

  useEffect(() => {
    if (!supported) {
      setState("unsupported");
      return;
    }
    if (!client || !enabled) return;
    let alive = true;
    let busy = false;
    const read = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const r = await client.box<TranscriptResult>(box, "GET", `sessions/${encodeURIComponent(session)}/transcript?since=${next.current}`);
        if (!alive) return;
        if (r.source === "none") {
          setState("none");
          return;
        }
        if (r.items?.length) useConversations.getState().merge(key, r.items);
        useConversations.getState().setCrew(key, r.crew ?? []);
        next.current = r.next ?? next.current;
        setState("ready");
      } catch {
        if (alive) setState((s) => (s === "ready" ? s : "error"));
      } finally {
        busy = false;
      }
    };
    void read();
    const t = window.setInterval(() => void read(), 2000);
    const onVisible = () => {
      if (!document.hidden) void read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [client, box, session, key, supported, enabled, latest]);

  return state;
}

// useAsk is what an agent waiting for the person asks, from its screen: the
// numbered options, and the line above them as the question.
export function useAsk(box: string, session: string, waiting: boolean, since?: string): { detail: string; choices: Choice[] } | undefined {
  const client = useStore((s) => s.client);
  const [ask, setAsk] = useState<{ detail: string; choices: Choice[] }>();
  useEffect(() => {
    if (!client || !waiting) {
      setAsk(undefined);
      return;
    }
    let alive = true;
    boxApi
      .screen(client, box, session)
      .then((r) => {
        if (!alive) return;
        const screen = r.screen ?? "";
        const choices = choicesIn(screen);
        const lines = screen.split("\n").map((l) => l.trim());
        const first = lines.findIndex((l) => /^(?:[❯›>]\s*)?1[.)]\s/.test(l));
        let detail = "";
        for (let i = (first < 0 ? lines.length : first) - 1; i >= 0; i--) {
          const l = lines[i].replace(/^[│|╭╰─\s]+|[│|╮╯─\s]+$/g, "");
          if (l) {
            detail = l;
            break;
          }
        }
        setAsk({ detail, choices });
      })
      .catch(() => alive && setAsk({ detail: "", choices: [] }));
    return () => {
      alive = false;
    };
  }, [client, box, session, waiting, since]);
  return ask;
}
