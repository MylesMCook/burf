import { ArrowLeftIcon, PanelLeftIcon, TerminalIcon } from "lucide-react";
import { useEffect } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { useAllSessions } from "@/hooks/use-agent-counts";
import { isMock } from "@/hooks/use-berth-connection";
import { boxApi } from "@/lib/api";
import { agentLabel } from "@/lib/derive";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/workspaces";
import { type Send, Composer } from "@/views/shore/composer";
import { CrewPanel } from "@/views/shore/crew-panel";
import { type Boat, Harbour, useBoats } from "@/views/shore/harbour";
import { finishTurn, playTurn, seedTranscript } from "@/views/shore/mock-play";
import { Ocean } from "@/views/shore/ocean";
import { keyOf, useShore } from "@/views/shore/shore-store";
import { TranscriptView } from "@/views/shore/transcript-view";
import "@/views/shore/shore.css";

// ShoreMode is Berth with everything but the agents put away: open water,
// your agents as boats, one composer to start work, and a calm transcript
// of what an agent is doing. The full app is a click away.

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 3)
    .join("-") || "task";

export function ShoreMode() {
  const view = useShore((s) => s.view);
  const all = useAllSessions();
  const boats = useBoats(all);
  const open = view.kind === "session";
  const needs = boats.filter((b) => b.state === "waiting").length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useShore.getState().view.kind === "session") useShore.getState().setView({ kind: "home" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openBoat = (b: Boat) => {
    if (isMock()) seedTranscript(b.box, b.session, b.state, b.title);
    useShore.getState().setView({ kind: "session", box: b.box, session: b.session, title: b.title, agent: b.agent });
  };

  const start = async (s: Send) => {
    const client = useStore.getState().client;
    if (!client) return;
    const name = slug(s.text);
    const res = await boxApi.createTask(client, s.box, { location: s.location, name: s.where === "new" ? name : s.location, agent: s.agent, prompt: s.text });
    void useStore.getState().refreshBox(s.box);
    const session = res.session.name;
    useShore.getState().setView({ kind: "session", box: s.box, session, title: s.where === "new" ? name : s.location, agent: s.agent });
    if (isMock()) void playTurn(s.box, session, s.text);
    else useShore.getState().push(keyOf(s.box, session), { kind: "user", id: `u${Date.now()}`, text: s.text });
  };

  return (
    <div className="shore fixed inset-0 overflow-hidden bg-[#2f62c4] text-slate-800">
      <Ocean still={open} />
      {/* Mist rolls in over the water while a session is open. */}
      <div className={cn("pointer-events-none absolute inset-0 bg-[#eef3f8] transition-opacity duration-700", open ? "opacity-[0.9]" : "opacity-0")} />

      <header data-tauri-drag-region className="relative z-10 flex h-11 items-center gap-2 pr-3 pl-[84px]">
        {open ? (
          <button type="button" onClick={() => useShore.getState().setView({ kind: "home" })} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-slate-600 hover:bg-white/60">
            <ArrowLeftIcon className="size-3.5" />
            Harbour
          </button>
        ) : (
          <span className="rounded-full bg-white/70 px-2.5 py-1 font-medium text-[12.5px] text-slate-700 backdrop-blur-sm">
            {boats.length ? `${boats.length} agent${boats.length === 1 ? "" : "s"}${needs ? ` · ${needs} need${needs === 1 ? "s" : ""} you` : ""}` : "No agents out"}
          </span>
        )}
        {open && view.kind === "session" && (
          <span className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <AgentIcon agent={view.agent} className="size-3.5" />
            <span className="truncate font-medium">{view.title}</span>
            <span className="text-slate-400">{agentLabel(view.agent)}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {open && view.kind === "session" && (
            <button
              type="button"
              onClick={() => {
                usePrefs.setState({ shore: false });
                void focusSession(view.box, view.session);
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] text-slate-600 hover:bg-white/60"
            >
              <TerminalIcon className="size-3.5" />
              Terminal
            </button>
          )}
          <button
            type="button"
            onClick={() => usePrefs.setState({ shore: false })}
            className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px]", open ? "text-slate-600 hover:bg-white/60" : "bg-white/70 text-slate-700 backdrop-blur-sm hover:bg-white/90")}
          >
            <PanelLeftIcon className="size-3.5" />
            Full app
          </button>
        </div>
      </header>

      <Harbour boats={boats} onOpen={openBoat} dim={open} />

      {open && view.kind === "session" ? (
        <Session box={view.box} session={view.session} />
      ) : (
        <div className="absolute inset-x-0 top-[40%] z-10 flex -translate-y-1/2 justify-center px-6">
          <Composer onSend={(s) => void start(s)} />
        </div>
      )}
    </div>
  );
}

function Session({ box, session }: { box: string; session: string }) {
  const key = keyOf(box, session);
  const items = useShore((s) => s.items[key]) ?? [];
  const crew = useShore((s) => s.crew[key]) ?? [];
  const answer = (id: string, yes: boolean) => {
    useShore.getState().update(key, id, { decided: yes ? "approved" : "denied" });
    if (isMock()) void finishTurn(box, session);
  };
  const followUp = (s: Send) => {
    useShore.getState().push(key, { kind: "user", id: `u${Date.now()}`, text: s.text });
    if (isMock()) void finishTurn(box, session);
  };
  return (
    <>
      <div className="absolute inset-x-0 top-11 bottom-0 z-10 overflow-y-auto">
        {items.length ? (
          <TranscriptView items={items} onAnswer={answer} />
        ) : (
          <p className="mx-auto mt-24 max-w-md text-center text-[14px] text-slate-500">
            The live transcript isn't wired to boxes yet in this preview. Open the terminal to see the agent.
          </p>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-5 z-10 flex justify-center px-6">
        <Composer docked onSend={followUp} placeholder="Reply, or ask for something else…" />
      </div>
      <CrewPanel crew={crew} />
    </>
  );
}
