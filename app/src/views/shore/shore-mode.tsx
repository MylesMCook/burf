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
import { Backdrop, useLight } from "@/views/shore/backdrop";
import { type Send, Composer } from "@/views/shore/composer";
import { CrewPanel } from "@/views/shore/crew-panel";
import { type Boat, Harbour, useBoats } from "@/views/shore/harbour";
import { finishTurn, playTurn, seedTranscript } from "@/views/shore/mock-play";
import { keyOf, useShore } from "@/views/shore/shore-store";
import { TranscriptView } from "@/views/shore/transcript-view";
import "@/views/shore/shore.css";

// ShoreMode is Berth with everything but the agents put away: the harbour
// seen from the shore, your agents as boats, one composer to start work, and
// a calm transcript of what an agent is doing. The full app is a click away.

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
  const light = useLight();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || useShore.getState().view.kind !== "session") return;
      // A menu or dialog open on top takes its own Escape.
      if (document.querySelector("[data-slot=menu-positioner], [role=dialog]")) return;
      useShore.getState().setView({ kind: "home" });
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

  const reply = (s: Send) => {
    const v = useShore.getState().view;
    if (v.kind !== "session") return;
    const key = keyOf(v.box, v.session);
    useShore.getState().push(key, { kind: "user", id: `u${Date.now()}`, text: s.text });
    if (isMock()) void finishTurn(v.box, v.session);
  };

  return (
    <div className="shore fixed inset-0 overflow-hidden bg-(--sh-sky) font-sans antialiased" data-light={light}>
      <Backdrop light={light} misted={open} />

      <Header boats={boats} onOpen={openBoat} />

      <Harbour boats={boats} onOpen={openBoat} away={open} />

      {open && <Session key={keyOf(view.box, view.session)} box={view.box} session={view.session} />}

      <div className="shore-dock z-10 px-6" data-docked={open ? "" : undefined}>
        <Composer docked={open} onSend={(s) => (open ? reply(s) : void start(s))} />
      </div>
    </div>
  );
}

const glassBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium text-(--sh-ink-2) text-[12.5px] transition-colors hover:text-(--sh-ink) [&_svg]:size-3.5";

function Header({ boats, onOpen }: { boats: Boat[]; onOpen(b: Boat): void }) {
  const view = useShore((s) => s.view);
  const open = view.kind === "session";
  const waiting = boats.filter((b) => b.state === "waiting");
  const out = boats.filter((b) => b.state === "running").length;
  const boat = open ? boats.find((b) => b.box === view.box && b.session === view.session) : undefined;
  const pill = "bg-(--sh-glass-2) shadow-(--sh-shadow-sm) ring-(--sh-edge) ring-1 backdrop-blur-xl hover:bg-(--sh-glass)";

  return (
    <header data-tauri-drag-region className="absolute inset-x-0 top-0 z-30 flex h-[52px] items-center gap-2 pr-3.5 pl-[84px]">
      {open ? (
        <button type="button" onClick={() => useShore.getState().setView({ kind: "home" })} className={cn(glassBtn, pill, "pl-2.5")}>
          <ArrowLeftIcon />
          Harbour
          <kbd className="ml-0.5 rounded bg-(--sh-chip-2) px-1 font-sans text-(--sh-ink-2) text-[10.5px] leading-4">esc</kbd>
        </button>
      ) : (
        <div className={cn("flex h-8 items-center gap-3 rounded-full px-3 text-[12.5px]", pill.replace(/hover:\S+/, ""))}>
          <span className="flex items-center gap-1.5 text-(--sh-ink-2)">
            <span className="size-1.5 rounded-full bg-(--sh-busy)" aria-hidden />
            <b className="font-semibold text-(--sh-ink)">{out}</b> out on the water
          </span>
          {waiting.length > 0 && (
            <button type="button" onClick={() => onOpen(waiting[0])} className="-mr-1.5 flex h-6 items-center gap-1.5 rounded-full bg-(--sh-lamp-pill) px-2 font-medium text-(--sh-lamp-ink) hover:brightness-95">
              <span className="shore-lamp size-2 rounded-full bg-(--sh-lamp)" aria-hidden />
              {waiting.length} need{waiting.length === 1 ? "s" : ""} you
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="-translate-x-1/2 pointer-events-none absolute left-1/2 flex max-w-[44%] items-center gap-2 text-[13px]">
          <AgentIcon agent={view.agent} className="size-3.5" />
          <span className="truncate font-semibold text-(--sh-ink)">{view.title}</span>
          <span className="shrink-0 text-(--sh-ink-3)">{agentLabel(view.agent)}</span>
          {boat?.state === "waiting" && <span className="shrink-0 rounded-full bg-(--sh-lamp-pill) px-2 py-px font-medium text-(--sh-lamp-ink) text-[11.5px]">Needs you</span>}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {open && (
          <button
            type="button"
            onClick={() => {
              usePrefs.setState({ shore: false });
              void focusSession(view.box, view.session);
            }}
            className={cn(glassBtn, "hover:bg-(--sh-chip)")}
          >
            <TerminalIcon />
            Terminal
          </button>
        )}
        <button type="button" onClick={() => usePrefs.setState({ shore: false })} className={cn(glassBtn, open ? "hover:bg-(--sh-chip)" : pill)}>
          <PanelLeftIcon />
          Full app
        </button>
      </div>
    </header>
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
  return (
    <>
      <div className="shore-rise absolute inset-x-0 top-[52px] bottom-0 z-10 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_28px,black_calc(100%-120px),transparent_calc(100%-40px))]">
        {items.length ? (
          <TranscriptView items={items} onAnswer={answer} />
        ) : (
          <p className="mx-auto mt-24 max-w-md text-center text-(--sh-ink-2) text-[14px]">
            The live transcript isn't wired to boxes yet in this preview. Open the terminal to see the agent.
          </p>
        )}
      </div>
      <CrewPanel crew={crew} />
    </>
  );
}
