import { useEffect, useRef, useState } from "react";

import { boxApi, type QueuedPrompt } from "@/lib/api";
import { keyOf, useConversations } from "@/lib/conversation-store";
import { useEventLog } from "@/lib/events";
import { choicesIn, type Choice, questionFormIn } from "@/lib/screen";
import { useStore } from "@/lib/store";
import type { Artifact, CrewMember, TranscriptItem } from "@/lib/transcript";

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
  // When the agent last wrote to its record (ms).
  last?: number;
  // The pages it published on claude.ai, newest last (newer boxes only).
  artifacts?: Artifact[];
}

export type FeedState = "loading" | "ready" | "none" | "unsupported" | "error";

export const hasTranscripts = (box: string) => !!useStore.getState().boxes[box]?.info?.capabilities?.includes("transcript");

// attempt, when it changes, reads again from where it was (a Retry).
export function useTranscriptFeed(box: string, session: string, dir: string | undefined, enabled: boolean, attempt = 0): FeedState {
  const client = useStore((s) => s.client);
  const supported = useStore((s) => !!s.boxes[box]?.info?.capabilities?.includes("transcript"));
  // Until the box has said what it can do (just after the app starts or
  // reconnects), it is not "too old": it is still loading.
  const known = useStore((s) => !!s.boxes[box]?.info);
  const [state, setState] = useState<FeedState>(supported || !known ? "loading" : "unsupported");
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
      setState(known ? "unsupported" : "loading");
      return;
    }
    if (!client || !enabled) return;
    // A retry reads afresh rather than standing on the last failure.
    setState((s) => (s === "error" ? "loading" : s));
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
        // Fewer items than were read: the box reads another file for this
        // session now (its own, once the agent writes one). Start it afresh,
        // so no other conversation's lines stay in this chat.
        if (typeof r.next === "number" && r.next < next.current) {
          useConversations.setState((s) => ({ items: { ...s.items, [key]: [] } }));
          next.current = 0;
          return;
        }
        if (r.items?.length) useConversations.getState().merge(key, r.items);
        useConversations.getState().setCrew(key, r.crew ?? []);
        if (r.last) useConversations.getState().setLast(key, r.last);
        useConversations.getState().setArtifacts(key, r.artifacts ?? []);
        next.current = r.next ?? next.current;
        setState("ready");
      } catch (err) {
        if (!alive) return;
        // The session is gone: nothing more will come.
        if ((err as { status?: number } | null)?.status === 404) {
          alive = false;
          window.clearInterval(t);
          setState((s) => (s === "ready" ? s : "none"));
          return;
        }
        setState((s) => (s === "ready" ? s : "error"));
      } finally {
        busy = false;
      }
    };
    void read();
    // An agent's record lands a moment after the event about it (its last
    // words after "finished"): look again soon rather than in 2s.
    const soon = [600, 1500].map((ms) => window.setTimeout(() => void read(), ms));
    const t = window.setInterval(() => void read(), 2000);
    const onVisible = () => {
      if (!document.hidden) void read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(t);
      for (const x of soon) window.clearTimeout(x);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [client, box, session, key, supported, known, enabled, latest, attempt]);

  return state;
}

// useAsk is what an agent waiting for the person asks, from its screen: the
// numbered options, and the line above them as the question; form says it
// shows a form of questions with steps, which no one number answers. A
// menu is drawn a moment after the agent says it waits, so a screen
// without one is read again a few times.
export function useAsk(box: string, session: string, waiting: boolean, since?: string): { detail: string; choices: Choice[]; form?: boolean } | undefined {
  const client = useStore((s) => s.client);
  const [ask, setAsk] = useState<{ detail: string; choices: Choice[]; form?: boolean }>();
  useEffect(() => {
    if (!client || !waiting) {
      setAsk(undefined);
      return;
    }
    let alive = true;
    let tries = 0;
    let timer = 0;
    const read = () =>
      boxApi
      .screen(client, box, session)
      .then((r) => {
        if (!alive) return;
        const screen = r.screen ?? "";
        const choices = choicesIn(screen);
        const form = questionFormIn(screen);
        if (!choices.length && !form && ++tries < 4) timer = window.setTimeout(() => void read(), 600);
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
        setAsk({ detail, choices, form });
      })
      .catch(() => alive && setAsk({ detail: "", choices: [] }));
    void read();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [client, box, session, waiting, since]);
  return ask;
}

export const hasQueue = (box: string) => !!useStore.getState().boxes[box]?.info?.capabilities?.includes("queue");

// useQueued is what the box holds for a session until its agent is idle
// (boxes with the "queue" capability): read when the session's count
// changes or something is queued, sent or cancelled, never while hidden.
// refresh reads it again at once.
export function useQueued(box: string, session: string, count: number | undefined, enabled: boolean): { items: QueuedPrompt[]; refresh(): void } {
  const client = useStore((s) => s.client);
  const supported = useStore((s) => !!s.boxes[box]?.info?.capabilities?.includes("queue"));
  const [items, setItems] = useState<QueuedPrompt[]>([]);
  const [tick, setTick] = useState(0);
  const latest = useEventLog((s) => s.events.find((e) => e.box === box && /^session\.(queued|unqueued|sent)$/.test(e.type) && e.data?.name === session)?.time);
  useEffect(() => {
    if (!client || !enabled || !supported || (!count && !tick)) {
      setItems([]);
      return;
    }
    let alive = true;
    boxApi
      .queue(client, box, session)
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [client, box, session, count, latest, enabled, supported, tick]);
  return { items, refresh: () => setTick((t) => t + 1) };
}
