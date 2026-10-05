import { BotIcon, ChevronDownIcon, EyeIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { create } from "zustand";

import { StateGlyph } from "@/components/agent-glyph";
import { ConversationView, type EditActions } from "@/components/conversation/conversation-view";
import { Markdown } from "@/components/conversation/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetDescription, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { boxApi } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { type Helper, historyApi } from "@/lib/history";
import { useStore } from "@/lib/store";
import type { TranscriptItem } from "@/lib/transcript";
import { cn } from "@/lib/utils";

// A helper's own conversation (a subagent Claude Code started), opened from
// the crew or from "Sent out 2 helpers" in the chat: read-only, in a sheet
// beside the chat, drawn as the chat is (its replies in Markdown, its steps
// folded, each call opening to what it ran and printed). Its siblings are a
// click away at the top. It reads while open, and holds nothing after.

interface OpenHelper {
  box: string;
  session: string;
  // The helper's id, or the id of the call that started it.
  ref: string;
}

// The sheet is drawn by one host (the first mounted), wherever the helper
// was opened from.
const useHelperSheet = create<{ open?: OpenHelper; hosts: string[] }>()(() => ({ hosts: [] }));

export function openHelper(box: string, session: string, ref: string) {
  useHelperSheet.setState({ open: { box, session, ref } });
}

export function HelperSheetHost() {
  const id = useId();
  const leader = useHelperSheet((s) => s.hosts[0] === id);
  const open = useHelperSheet((s) => s.open);
  useEffect(() => {
    useHelperSheet.setState((s) => ({ hosts: [...s.hosts, id] }));
    return () => useHelperSheet.setState((s) => ({ hosts: s.hosts.filter((h) => h !== id) }));
  }, [id]);
  if (!leader || !open) return null;
  return <HelperSheet key={`${open.box}/${open.session}`} {...open} onClose={() => useHelperSheet.setState({ open: undefined })} />;
}

const elapsed = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

function HelperSheet({ box, session, ref: first, onClose }: OpenHelper & { onClose(): void }) {
  const client = useStore((s) => s.client);
  const parent = useStore((s) => s.boxes[box]?.sessions?.find((x) => x.name === session)?.title);
  const [helpers, setHelpers] = useState<Helper[]>();
  const [listError, setListError] = useState<string>();
  const [sel, setSel] = useState(first);
  useEffect(() => setSel(first), [first]);

  // The helpers, again every few seconds while any works.
  const busy = !!helpers?.some((h) => h.state === "running");
  useEffect(() => {
    if (!client) return;
    let alive = true;
    const read = () =>
      historyApi.helpers(client, box, session).then(
        (hs) => alive && (setHelpers(hs), setListError(undefined)),
        (err) => alive && setListError(errorMessage(err)),
      );
    void read();
    const t = busy ? window.setInterval(read, 3000) : 0;
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [client, box, session, busy]);

  const h = helpers?.find((x) => x.id === sel || x.tool === sel) ?? helpers?.find((x) => x.name === sel);
  const siblings = helpers?.filter((x) => (x.depth ?? 1) <= 1 || x.id === h?.id) ?? [];
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (h?.state !== "running") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [h?.state]);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetPopup side="right" className="w-[min(760px,calc(100vw-48px))] max-w-none" aria-label={h ? `${h.name}: the helper's conversation` : "A helper's conversation"}>
        <div className="flex flex-col gap-3 border-b px-6 pt-5 pb-4">
          <div className="flex items-center gap-2 pr-10 text-muted-foreground text-xs">
            <BotIcon className="size-3.5" aria-hidden />
            <span className="min-w-0 truncate">{parent ? `A helper in “${parent}”` : "A helper"}</span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <EyeIcon className="size-3" aria-hidden />
              Read-only
            </span>
          </div>
          <SheetTitle className="truncate pr-10 text-lg">{h?.name ?? (helpers ? "Helper not found" : "Opening the helper…")}</SheetTitle>
          {h && (
            <SheetDescription render={<div />} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <StateGlyph state={h.state === "running" ? "running" : "finished"} />
                {h.state === "running" ? `Working · ${elapsed(now - h.started)}` : `Finished · took ${elapsed(h.updated - h.started)}`}
              </span>
              {h.type && <Badge variant="outline">{h.type}</Badge>}
              {h.background && <Badge variant="secondary">In the background</Badge>}
            </SheetDescription>
          )}
          {siblings.length > 1 && (
            <div role="tablist" aria-label="Helpers" className="-mx-1 flex gap-1 overflow-x-auto pb-0.5">
              {siblings.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={x.id === h?.id}
                  onClick={() => setSel(x.id)}
                  className={cn(
                    "flex h-7 max-w-56 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    x.id === h?.id ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <StateGlyph state={x.state === "running" ? "running" : "finished"} className="size-3" />
                  <span className="truncate">{x.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {!helpers && !listError && (
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            <Spinner className="mr-2 size-4" />
            Reading the helpers…
          </div>
        )}
        {listError && !helpers && <p className="m-6 text-destructive-foreground text-sm">Couldn't list the helpers: {listError}</p>}
        {helpers && !h && <p className="m-6 text-muted-foreground text-sm">This helper's conversation isn't on {box} (it may be from before the agent was resumed, or another session's).</p>}
        {h && <HelperChat key={h.id} box={box} session={session} h={h} />}
      </SheetPopup>
    </Sheet>
  );
}

function HelperChat({ box, session, h }: { box: string; session: string; h: Helper }) {
  const client = useStore((s) => s.client);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const next = useRef(0);
  const running = h.state === "running";

  useEffect(() => {
    if (!client) return;
    let alive = true;
    let busy = false;
    const read = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const r = await historyApi.helperTranscript(client, box, session, h.id, next.current);
        if (!alive) return;
        setItems((list) => {
          const out = [...list];
          const at = new Map(out.map((it, i) => [it.id, i]));
          for (const it of r.items ?? []) {
            const i = at.get(it.id);
            if (i === undefined) out.push(it);
            else out[i] = it;
          }
          return out.slice(-1000);
        });
        next.current = r.next ?? next.current;
        setState("ready");
      } catch (err) {
        if (!alive) return;
        setError(errorMessage(err));
        setState((s) => (s === "ready" ? s : "error"));
      } finally {
        busy = false;
      }
    };
    void read();
    const t = running ? window.setInterval(() => void read(), 2000) : 0;
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [client, box, session, h.id, running, attempt]);

  const edits = useMemo<EditActions | undefined>(
    () =>
      client
        ? {
            load: (file) => boxApi.diff(client, box, session, file),
            tool: (id) => historyApi.helperTool(client, box, session, h.id, id),
            comments: () => undefined,
            review: () => useStore.getState().setView({ kind: "review" }),
          }
        : undefined,
    [client, box, session, h.id],
  );

  // The first prompt is what the agent asked it: shown above, not as a
  // bubble the person sent.
  const prompt = items[0]?.kind === "user" ? items[0].text : h.prompt;
  const rest = items[0]?.kind === "user" ? items.slice(1) : items;
  const shown = running ? [...rest, { kind: "thinking" as const, id: "live:helper", since: h.updated }] : rest;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-8">
      {prompt && <AskedBy text={prompt} />}
      {state === "loading" && (
        <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
          <Spinner className="mr-2 size-4" />
          Reading its conversation…
        </div>
      )}
      {state === "error" && (
        <div className="flex flex-col items-start gap-2 text-sm">
          <p className="text-destructive-foreground">Couldn't read its conversation: {error}</p>
          <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            <RefreshCwIcon />
            Retry
          </Button>
        </div>
      )}
      {state === "ready" && !shown.length && <p className="text-muted-foreground text-sm">It hasn't done anything yet.</p>}
      {state === "ready" && shown.length > 0 && <ConversationView items={shown} onAnswer={() => {}} edits={edits} who="The helper" className="max-w-none" />}
    </div>
  );
}

// AskedBy is the helper's task, as the agent wrote it: folded to a few
// lines when long.
function AskedBy({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320 || text.split("\n").length > 6;
  return (
    <div className="mb-5 rounded-lg border bg-muted/40 px-4 py-3">
      <div className="mb-1.5 font-medium text-muted-foreground text-xs">Asked by the agent</div>
      <div className={cn("relative text-[0.8438rem]", long && !open && "max-h-32 overflow-hidden")}>
        <Markdown text={text} copy={false} />
        {long && !open && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-muted/90 to-transparent" />}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1.5 inline-flex items-center gap-1 rounded text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDownIcon className={cn("size-3 transition-transform", open && "rotate-180")} />
          {open ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}
