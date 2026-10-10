import * as stylex from "@stylexjs/stylex";
import { CloudOffIcon, ListStartIcon, RotateCcwIcon, SendIcon, TrashIcon } from "lucide-react";
import { type RefObject, useMemo, useRef, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { SimpleSelect } from "@/components/simple-select";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { isMock } from "@/hooks/use-burf-connection";
import { agentOf, guessAgent, sessionName } from "@/lib/derive";
import { ago, errorMessage } from "@/lib/format";
import { mockBoxes, mockSetBoxOnline } from "@/lib/mock-queue";
import { type QueueItem, discard, openQueue, preview, retarget, retry, sendNow, targetName, useQueue } from "@/lib/queue";
import { useStore } from "@/lib/store";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "marginLeft": "calc(4px * -1)",
    "marginRight": "calc(4px * -1)",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s1: {
    "color": "var(--destructive-foreground)",
  },
  s2: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--destructive)",
  },
  s3: {
    "width": "12px",
    "height": "12px",
  },
  s4: {
    "display": "flex",
    "maxHeight": "min(32rem,70vh)",
    "flexDirection": "column",
  },
  s5: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "10px",
  },
  s6: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s7: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "outline": "none",
  },
  s9: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "32px",
    "paddingBottom": "32px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s10: {
    "position": "sticky",
    "top": "0px",
    "zIndex": 1,
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s11: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s12: {
    "backgroundColor": "var(--success)",
  },
  s13: {
    "fontWeight": 400,
  },
  s14: {
    "color": "var(--destructive-foreground)",
  },
  s15: {
    "color": "var(--info-foreground)",
  },
  s16: {
    "color": "var(--info-foreground)",
  },
  s17: {
    "color": "var(--warning-foreground)",
  },
  s18: {
    "color": "var(--muted-foreground)",
  },
  s19: {
    "color": "var(--muted-foreground)",
  },
  s20: {
    "borderBottomWidth": {
      "default": 1,
      ":last-child": 0,
    },
    "borderBottomStyle": {
      "default": "solid",
      ":last-child": "solid",
    },
    "borderBottomColor": {
      "default": "var(--border)",
      ":last-child": "var(--border)",
    },
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s21: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
  },
  s22: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s23: {
    "marginLeft": "auto",
    "flexShrink": 0,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s24: {
    "marginTop": "4px",
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "overflowWrap": "break-word",
    "fontSize": "12.5px",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "lineHeight": "1.375",
  },
  s25: {
    "marginTop": "4px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "marginTop": "6px",
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
  },
  s27: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
  },
  s28: {
    "width": "12px",
    "height": "12px",
  },
  s29: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s30: {
    "height": "24px",
    "fontSize": "11px",
  },
  s31: {
    "height": "24px",
    "fontSize": "11px",
  },
  s32: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "6px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s33: {
    "fontWeight": 500,
  },
  s34: {
    "height": "24px",
    "fontSize": "11px",
  },
  s35: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s36: {
    "backgroundColor": "var(--success)",
  },
  s37: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  n0: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  n1: {
    "backgroundColor": "var(--success)",
  },
  n2: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  n3: {
    "backgroundColor": "var(--warning)",
  },

  s38: {
    backgroundColor: { "[data-popup-open]": color.accent },
    color: { "[data-popup-open]": color.foreground },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// QueueIndicator is the status bar's "Queued (n)": prompts the laptop agent
// keeps for boxes that are away. It opens a list to send, retry, move or
// discard them. It only shows while something is queued (always in mock
// mode, for the simulator).
export function QueueIndicator() {
  const items = useQueue((s) => s.items);
  const open = useQueue((s) => s.open);
  const failed = items.filter((i) => i.state === "failed").length;
  // The keyboard starts on the list, not on the first row's Discard: Enter
  // right after opening must never throw a prompt away.
  const list = useRef<HTMLDivElement>(null);
  if (!items.length && !isMock()) return null;
  return (
    <Popover open={open} onOpenChange={(o) => openQueue(o)}>
      <Tip label={failed ? `${failed} queued ${failed === 1 ? "prompt" : "prompts"} could not be sent` : "Prompts waiting for their box to come back"}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={[[sx(paint.s0), sx(paint.s38)].filter(Boolean).join(" "), failed > 0 && sx(paint.s1)].filter(Boolean).join(" ")}
            />
          }
        >
          {failed > 0 ? <span className={sx(paint.s2)} /> : <ListStartIcon className={sx(paint.s3)} />}
          Queued ({items.length})
        </PopoverTrigger>
      </Tip>
      <PopoverPopup initialFocus={list} side="top" align="start" sideOffset={6} flush width="26">
        <QueuePanel items={items} list={list} />
      </PopoverPopup>
    </Popover>
  );
}

function QueuePanel({ items, list }: { items: QueueItem[]; list: RefObject<HTMLDivElement | null> }) {
  const status = useStore((s) => s.status);
  const state = (box: string) => status?.boxes.find((b) => b.name === box)?.state ?? "unknown";
  const byBox = useMemo(() => [...new Set(items.map((i) => i.box))].map((box) => [box, items.filter((i) => i.box === box)] as const), [items]);
  return (
    <div className={sx(paint.s4)}>
      <div className={sx(paint.s5)}>
        <div className={sx(paint.s6)}>Queued prompts</div>
        <p className={sx(paint.s7)}>Kept by Burf on this Mac and typed in when their box is back, in order for each agent, after its current turn.</p>
      </div>
      <div ref={list} tabIndex={-1} role="region" aria-label="Queued prompts" className={sx(paint.s8)}>
        {items.length === 0 && <p className={sx(paint.s9)}>Nothing queued. A prompt for a box that is offline can wait here.</p>}
        {byBox.map(([box, list]) => (
          <div key={box}>
            <div className={sx(paint.s10)}>
              <span className={[sx(paint.n0), state(box) === "online" ? sx(paint.n1) : state(box) === "offline" ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")} />
              {box}
              <span className={sx(paint.s13)}>· {state(box) === "online" ? "online" : state(box) === "offline" ? "offline" : state(box)}</span>
            </div>
            {list.map((it) => (
              <Row key={it.id} it={it} online={state(box) === "online"} />
            ))}
          </div>
        ))}
      </div>
      {isMock() && <Simulator />}
    </div>
  );
}

const label = (it: QueueItem, online: boolean): { text: string; className: string } => {
  if (it.state === "failed") return { text: "Failed", className: sx(paint.s14) };
  if (it.state === "sending") return { text: "Sending…", className: sx(paint.s15) };
  if (it.state === "waiting") return { text: "Waiting for its turn to end", className: sx(paint.s16) };
  if (it.blocked) return { text: "Behind a failed prompt", className: sx(paint.s17) };
  return online ? { text: "Sending soon", className: sx(paint.s18) } : { text: "Waiting for the box", className: sx(paint.s19) };
};

function Row({ it, online }: { it: QueueItem; online: boolean }) {
  const boxData = useStore((s) => s.boxes[it.box]);
  const session = boxData?.sessions?.find((s) => s.name === it.session);
  const [busy, setBusy] = useState<string>();
  const st = label(it, online);
  const act = async (what: string, fn: () => Promise<unknown>) => {
    setBusy(what);
    try {
      await fn();
    } catch (err) {
      toastManager.add({ title: "Couldn't do that", description: errorMessage(err), type: "error" });
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <div className={sx(paint.s20)}>
      <div className={sx(paint.s21)}>
        <AgentIcon agent={session ? agentOf(session) : guessAgent(it.session)} />
        <Tip label={`Session ${it.session} on ${it.box}`} align="start">
          <span className={sx(paint.s22)}>{targetName(it.box, it.session)}</span>
        </Tip>
        <span className={sx(paint.s23)}>{ago(it.created)}</span>
      </div>
      <Tip label={it.text} width="lg">
        <p className={sx(paint.s24)}>{preview(it.text, 240)}</p>
      </Tip>
      {/* The agent's errors name the session by id; say it as the row does. */}
      {it.error && <p className={sx(paint.s25)}>{it.error.split(it.session).join(targetName(it.box, it.session))}</p>}
      <div className={sx(paint.s26)}>
        <span className={[sx(paint.s27), st.className].filter(Boolean).join(" ")}>
          {(it.state === "sending" || it.state === "waiting") && <Spinner  size="sm"/>}
          {!online && it.state === "queued" && !it.blocked && <CloudOffIcon className={sx(paint.s28)} />}
          {st.text}
        </span>
        <span className={sx(paint.s29)} />
        {it.state === "failed" && <MoveTo it={it} />}
        {it.state === "failed" && (
          <Tip label="Put it back in line, to send when the agent is free">
            <span className={sx(paint.s30)}><Button size="xs" variant="ghost"  loading={busy === "retry"} onClick={() => act("retry", () => retry(it.id))}>
              <RotateCcwIcon />
              Retry
            </Button></span>
          </Tip>
        )}
        <Tip label={online ? "Type it in now, without waiting for the agent's turn to end" : `${it.box} is offline`}>
          <span className={sx(paint.s31)}><Button
            size="xs"
            variant="ghost"
            
            disabled={!online || it.state === "sending"}
            loading={busy === "send"}
            onClick={() =>
              act("send", async () => {
                const r = await sendNow(it.id);
                if (r.state === "delivered") toastManager.add({ title: `Sent to ${targetName(it.box, it.session)}`, type: "success" });
                else if (r.state === "failed") toastManager.add({ title: "Couldn't send it", description: r.error, type: "error" });
              })
            }>
            <SendIcon />
            Send now
          </Button></span>
        </Tip>
        <Tip label="Discard this prompt">
          <Button size="icon-xs" variant="ghost" aria-label="Discard" disabled={it.state === "sending"} loading={busy === "discard"} onClick={() => act("discard", () => discard(it.id))}>
            <TrashIcon />
          </Button>
        </Tip>
      </div>
    </div>
  );
}

// MoveTo retargets a failed prompt to another agent on an online box.
function MoveTo({ it }: { it: QueueItem }) {
  const boxes = useStore((s) => s.boxes);
  const status = useStore((s) => s.status);
  const options = useMemo(() => {
    const online = new Set(status?.boxes.filter((b) => b.state === "online").map((b) => b.name));
    return Object.entries(boxes)
      .filter(([box]) => online.has(box))
      .flatMap(([box, d]) =>
        (d.sessions ?? [])
          .filter((s) => !s.exited && agentOf(s) && !(box === it.box && s.name === it.session))
          .map((s) => ({ value: `${box}\u0000${s.name}`, label: `${sessionName(s, { sessions: d.sessions, locations: d.locations, place: true })} — ${box}` })),
      );
  }, [boxes, status, it.box, it.session]);
  if (!options.length) return null;
  return (
    <SimpleSelect
      size="xs"
      measure="32"
      options={options}
      value=""
      placeholder="Move to…"
      onChange={(v) => {
        const [box, session] = v.split("\u0000");
        if (box && session) retarget(it.id, box, session).catch((err) => toastManager.add({ title: "Couldn't move it", description: errorMessage(err), type: "error" }));
      }}
    />
  );
}

// Simulator takes mock boxes offline and back, so the queue can be seen
// filling and draining without a real box.
function Simulator() {
  useStore((s) => s.status);
  const boxes = mockBoxes();
  return (
    <div className={sx(paint.s32)}>
      <span className={sx(paint.s33)}>Simulate</span>
      {boxes.map((b) => (
        <span className={sx(paint.s34)}><Button
          key={b.name}
          size="xs"
          variant="outline"
          
          onClick={() => {
            mockSetBoxOnline(b.name, !b.online);
          }}>
          <span className={[sx(paint.s35), b.online ? sx(paint.s36) : sx(paint.s37)].filter(Boolean).join(" ")} />
          {b.online ? `Take ${b.name} offline` : `Bring ${b.name} back`}
        </Button></span>
      ))}
    </div>
  );
}
