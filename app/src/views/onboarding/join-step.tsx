import * as stylex from "@stylexjs/stylex";
import { ArrowRightIcon, CheckIcon, ChevronRightIcon, ExternalLinkIcon, NetworkIcon, ServerIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { StepHeader } from "@/components/step-header";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { DialogPanel } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { laptopApi } from "@/lib/api";
import { boxList, computersApi, countdown, findJoinLink, type JoinOutput, type JoinResult, secondsLeft } from "@/lib/computers";
import { plainError } from "@/lib/errors";
import { openUrl } from "@/lib/open-url";
import { useStore } from "@/lib/store";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "40px",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--input)",
      ":focus-within": "var(--ring)",
    },
    "backgroundColor": {
      "default": "light-dark(var(--background), color-mix(in oklab, var(--input) 32%, transparent))",
    },
    "paddingInlineStart": "12px",
    "paddingInlineEnd": "4px",
    "boxShadow": {
      "default": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
      ":focus-within": "0 0 0 2px color-mix(in oklab, var(--ring) 24%, transparent)",
    },
  },
  s1: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s2: {
    "height": "100%",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "backgroundColor": "transparent",
    "fontFamily": {
      "default": "var(--font-mono)",
      "::placeholder": "var(--font-sans)",
    },
    "fontSize": {
      "default": "13px",
      "::placeholder": "14px",
    },
    "outline": "none",
    "color": {
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
    },
    "lineHeight": {
      "::placeholder": "20px",
    },
    "opacity": {
      ":disabled": 0.64,
    },
  },
  s3: {
    "flexShrink": 0,
  },
  s4: {
    "marginTop": "8px",
    "minHeight": "20px",
    "fontSize": "12px",
    "lineHeight": "20px",
  },
  s5: {
    "color": "var(--destructive-foreground)",
  },
  s6: {
    "color": "var(--muted-foreground)",
  },
  s7: {
    "color": "var(--warning-foreground)",
  },
  s8: {
    "color": "var(--foreground)",
  },
  s9: {
    "color": "var(--muted-foreground)",
  },
  s10: {
    "marginTop": "16px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s11: {
    "marginTop": "20px",
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
  },
  s12: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "marginTop": "24px",
  },
  s14: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s15: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s16: {
    "width": "16px",
    "height": "16px",
    "color": "var(--success-foreground)",
  },
  s17: {
    "width": "16px",
    "height": "16px",
    "color": "var(--warning-foreground)",
  },
  s18: {
    "width": "16px",
    "height": "16px",
    "color": "var(--destructive-foreground)",
  },
  s19: {
    "width": "16px",
    "height": "16px",
    "color": "var(--muted-foreground)",
  },
  s20: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s21: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s22: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
  },
  s23: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s24: {
    "flexShrink": 0,
  },

  s25: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s26: {
    color: color.mutedForeground,
  },
  s27: {
    color: color.destructiveForeground,
  },
  s28: {
    color: "var(--warning-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// What joining is doing, for onboarding's scene, as AddBoxStage is for
// connecting a box: arriving while it waits, the lighthouse while pairing,
// the signal lamp while signing in to another tailnet, moored once done.
export type JoinStage = "start" | "working" | "tailnet" | "paired";

const settled = (r: JoinResult) => r.status === "paired" || r.status === "already";

// JoinFlow pairs this computer with every box another computer of yours
// invited it to: paste the join link (the whole message is fine), see which
// boxes it holds, pair with all of them at once. A box on a tailnet this
// computer is not on asks for that tailnet's sign-in, then pairs. The other
// computer stays paired. Onboarding shows it as a page; Settings → Computers
// as a dialog.
export function JoinFlow({
  variant,
  onDone,
  onExit,
  onStage,
}: {
  variant: "page" | "dialog";
  onDone(boxes: string[]): void;
  onExit?(): void;
  onStage?(stage: JoinStage): void;
}) {
  const client = useStore((s) => s.client);
  const [text, setText] = useState("");
  const [link, setLink] = useState<string>();
  const [info, setInfo] = useState<JoinOutput>();
  const [rows, setRows] = useState<JoinResult[]>([]);
  const [phase, setPhase] = useState<"paste" | "checking" | "review" | "joining" | "joined">("paste");
  const [error, setError] = useState<string>();
  const [signing, setSigning] = useState<{ network: string; url?: string }>();
  const abort = useRef<AbortController>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const left = useSecondsLeft(info?.expires);
  const expired = !!info && left === 0;

  const allSettled = rows.length > 0 && rows.every(settled);
  useEffect(() => {
    onStage?.(signing ? "tailnet" : phase === "checking" || phase === "joining" ? "working" : allSettled && phase === "joined" ? "paired" : "start");
  }, [onStage, signing, phase, allSettled]);

  const check = async (value = text) => {
    if (!client) return;
    const found = findJoinLink(value);
    if (!found) {
      setError(value.trim() ? "There's no join link in that. It starts with berth://join? and comes from Settings → Computers on your other computer." : "Paste the join link from your other computer first.");
      return;
    }
    setLink(found);
    setText(found);
    setPhase("checking");
    setError(undefined);
    try {
      const out = await computersApi.checkJoin(client, found);
      setInfo(out);
      setRows(out.boxes);
      setPhase("review");
    } catch (err) {
      setError(plainError(err));
      setPhase("paste");
    }
  };

  const join = async () => {
    if (!client || !link) return;
    setPhase("joining");
    setError(undefined);
    try {
      const out = await computersApi.join(client, link);
      // Joining again (after a sign-in) reports the boxes paired a moment
      // ago as already paired; they still read as paired here.
      setRows((prev) => out.boxes.map((r) => (r.status === "already" && prev.find((p) => p.name === r.name)?.status === "paired" ? prev.find((p) => p.name === r.name)! : r)));
      await useStore.getState().refreshAll();
    } catch (err) {
      setError(plainError(err));
    }
    setPhase("joined");
  };

  // Signing in to the tailnet a box is on, then pairing again: boxes already
  // paired just say so, and the code of the one that was waiting is unused.
  const signIn = async (network: string) => {
    if (!client) return;
    abort.current = new AbortController();
    setSigning({ network });
    setError(undefined);
    try {
      await laptopApi.networkLogin(
        client,
        network,
        (url) => {
          setSigning({ network, url });
          void openUrl(url);
        },
        abort.current.signal,
      );
      setSigning(undefined);
      await join();
    } catch (err) {
      if (!abort.current?.signal.aborted) setError(plainError(err));
      setSigning(undefined);
    }
  };

  const ready = rows.filter((r) => r.status === "ready").length;
  const done = rows.filter(settled).map((r) => r.name);
  const head = {
    title: "Join from your other computer",
    description: "On the computer you already use, open Settings → Computers → Add another computer, then paste the link it makes here. This computer pairs with the same boxes, and both keep working.",
  };

  const body = (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
        className={sx(paint.s0)}
      >
        <ChevronRightIcon aria-hidden className={sx(paint.s1)} />
        <input
          autoFocus
          value={text}
          disabled={phase !== "paste"}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Join link"
          aria-invalid={error && phase === "paste" ? true : undefined}
          placeholder="berth://join?…  paste the link from your other computer"
          onPaste={(e) => {
            const found = findJoinLink(e.clipboardData.getData("text"));
            if (!found) return;
            // A whole message: keep only the link, and read it at once.
            e.preventDefault();
            setText(found);
            void check(found);
          }}
          onChange={(e) => {
            setText(e.target.value);
            setError(undefined);
          }}
          className={sx(paint.s2)}
        />
        {phase === "paste" || phase === "checking" ? (
          <span className={sx(paint.s3)}><Button type="submit" size="xs"  disabled={!text.trim()} loading={phase === "checking"}>
            Continue
          </Button></span>
        ) : (
          <Tip label="Use another link">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Use another link"
              disabled={phase === "joining" || !!signing}
              onClick={() => {
                setText("");
                setLink(undefined);
                setInfo(undefined);
                setRows([]);
                setError(undefined);
                setPhase("paste");
              }}
            >
              <XIcon />
            </Button>
          </Tip>
        )}
      </form>

      {/* One line under the field, whatever it says, so nothing below moves. */}
      <div aria-live="polite" className={sx(paint.s4)}>
        {error ? (
          <span className={sx(paint.s5)}>{error}</span>
        ) : info ? (
          <span className={[sx(paint.s6), expired && sx(paint.s7)].filter(Boolean).join(" ")}>
            From <span className={sx(paint.s8)}>{info.from}</span> · {expired ? "this link has expired; make a new one there" : `expires in ${countdown(left)}`}
          </span>
        ) : (
          <span className={sx(paint.s9)}>It works once, for ten minutes. Pasting the whole message is fine.</span>
        )}
      </div>

      {rows.length > 0 && (
        <ul className={[sx(paint.s10), sx(paint.s25)].filter(Boolean).join(" ")} aria-label="Boxes in the link">
          {rows.map((r) => (
            <BoxRow key={r.name} r={r} pairing={phase === "joining" && !settled(r) && r.status !== "failed"} signing={signing?.network === r.network ? signing : undefined} busy={phase === "joining" || !!signing} onSignIn={() => r.network && void signIn(r.network)} onCancel={() => abort.current?.abort()} />
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div className={sx(paint.s11)}>
          {phase === "review" || phase === "joining" ? (
            ready > 0 ? (
              <Button onClick={() => void join()} loading={phase === "joining"} disabled={expired}>
                Pair with {ready === 1 ? "1 box" : `${ready} boxes`}
              </Button>
            ) : (
              <Button onClick={() => onDone(done)}>
                Continue <ArrowRightIcon />
              </Button>
            )
          ) : (
            // While a box waits for a sign-in, that is the next step, not this.
            <Button variant={rows.some((r) => r.status === "needs-network") ? "outline" : "default"} disabled={done.length === 0 || !!signing} onClick={() => onDone(done)}>
              {allSettled ? "Continue" : `Continue with ${boxList(done)}`} <ArrowRightIcon />
            </Button>
          )}
          {phase === "joined" && !allSettled && rows.some((r) => r.status === "failed") && <span className={sx(paint.s12)}>For the others, make a new link on {info?.from ?? "your other computer"}.</span>}
        </div>
      )}
    </div>
  );

  if (variant === "dialog") {
    return (
      <>
        <StepHeader title={head.title} description={head.description} onBack={onExit} />
        <DialogPanel inset="body">{body}</DialogPanel>
      </>
    );
  }
  return (
    <div>
      <StepHeader variant="page" title={head.title} description={head.description} onBack={onExit} />
      <div className={sx(paint.s13)}>{body}</div>
    </div>
  );
}

function BoxRow({
  r,
  pairing,
  signing,
  busy,
  onSignIn,
  onCancel,
}: {
  r: JoinResult;
  pairing: boolean;
  signing?: { network: string; url?: string };
  busy: boolean;
  onSignIn(): void;
  onCancel(): void;
}) {
  const where = r.tailnet ? `the ${r.tailnet} tailnet` : `the ${r.network} network`;
  let detail: string;
  let tone = (sx(paint.s26) ?? "");
  if (pairing) detail = "Pairing…";
  else if (r.status === "paired") detail = `Paired${r.address ? ` · ${r.address}` : ""}${r.network ? ` through ${r.network}` : ""}`;
  else if (r.status === "already") detail = "Already paired with this computer";
  else if (r.status === "needs-network") {
    detail = signing ? (signing.url ? "Waiting for you to approve the sign-in in your browser…" : "Starting the sign-in…") : `On ${where}: sign in to reach it`;
    tone = signing ? sx(paint.s26) : sx(paint.s28);
  } else if (r.status === "failed") {
    detail = r.error ?? "Not paired";
    tone = (sx(paint.s27) ?? "");
  } else detail = r.sign_in ? `${r.address ?? ""} · on ${where}; you may need to sign in to it` : (r.address ?? "Ready");

  return (
    <li className={sx(paint.s14)}>
      <span className={sx(paint.s15)}>
        {pairing || signing ? (
          <Spinner  size="lg" muted/>
        ) : settled(r) ? (
          <CheckIcon aria-label="Paired" className={sx(paint.s16)} />
        ) : r.status === "needs-network" ? (
          <NetworkIcon aria-label="Needs a sign-in" className={sx(paint.s17)} />
        ) : r.status === "failed" ? (
          <XIcon aria-label="Not paired" className={sx(paint.s18)} />
        ) : (
          <ServerIcon aria-hidden className={sx(paint.s19)} />
        )}
      </span>
      <div className={sx(paint.s20)}>
        <div className={sx(paint.s21)}>{r.name}</div>
        <div className={[sx(paint.s22), tone].filter(Boolean).join(" ")}>{detail}</div>
      </div>
      {r.status === "needs-network" &&
        (signing ? (
          <span className={sx(paint.s23)}>
            {signing.url && (
              <Button size="xs" variant="ghost" onClick={() => void openUrl(signing.url!)}>
                <ExternalLinkIcon /> Open again
              </Button>
            )}
            <Button size="xs" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </span>
        ) : (
          <span className={sx(paint.s24)}><Button size="xs" variant="outline"  disabled={busy} onClick={onSignIn}>
            Sign in
          </Button></span>
        ))}
    </li>
  );
}

// useSecondsLeft counts down to an ISO time, a second at a time.
export function useSecondsLeft(iso?: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [iso]);
  return iso ? secondsLeft(iso, now) : 0;
}

// JoinStep is onboarding's "I already use Burf on another computer".
export function JoinStep({ onDone, onExit, onStage }: { onDone(): void; onExit(): void; onStage(stage: JoinStage): void }) {
  // A beat on the moored scene before moving on, as connecting a box has.
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => done.current(), 400);
    return () => clearTimeout(t);
  }, [leaving]);
  return <JoinFlow variant="page" onExit={onExit} onStage={onStage} onDone={() => setLeaving(true)} />;
}
