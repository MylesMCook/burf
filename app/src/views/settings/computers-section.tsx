import * as stylex from "@stylexjs/stylex";
import { CopyIcon, LaptopIcon, MonitorIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";

import { StepHeader } from "@/components/step-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogFooter, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { type BoxStatus, ApiError } from "@/lib/api";
import { boxList, computersApi, countdown, type Invite, type TrustedComputer } from "@/lib/computers";
import { useEventLog } from "@/lib/events";
import { ago, errorMessage } from "@/lib/format";
import { plainError } from "@/lib/errors";
import { NONE, useStore } from "@/lib/store";
import { JoinFlow, useSecondsLeft } from "@/views/onboarding/join-step";
import { ConfirmDialog } from "@/views/settings/confirm";
import { Code, SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";
import { ErrorText } from "@/components/error-note";
import { BoxError } from "@/components/upgrade-box";

const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const paint = stylex.create({
  s0: {
    "minWidth": "96px",
  },
  s1: {
    "minWidth": "96px",
  },
  s2: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "marginLeft": "16px",
    "marginRight": "16px",
    "marginTop": "12px",
    "marginBottom": "12px",
  },
  s4: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "display": "flex",
    "minHeight": "48px",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s6: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s7: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s8: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s9: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s10: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s13: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s14: {
    "cursor": "pointer",
  },
  s15: {
    "opacity": 0.64,
  },
  s16: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s17: {
    "display": "block",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s18: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s19: {
    "marginTop": "16px",
    "display": "flex",
    "gap": "10px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--warning) 32%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 6%, transparent)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s20: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--warning-foreground)",
  },
  s21: {
    "minWidth": "0px",
  },
  s22: {
    "marginTop": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s23: {
    "marginTop": "12px",
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s24: {
    "color": "var(--foreground)",
  },
  s25: {
    "display": "flex",
    "gap": "20px",
    "flexDirection": {
      "@media (max-width: 639px)": {
        "default": "column",
      },
    },
  },
  s26: {
    "width": "160px",
    "height": "160px",
    "flexShrink": 0,
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "backgroundColor": "#fff",
    "padding": "6px",
    ":not(#\\#) svg": {
      "width": "100%",
      "height": "100%",
    },
  },
  s27: {
    "opacity": 0.24,
  },
  s28: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "12px",
  },
  s29: {
    "display": "flex",
    "height": "36px",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingInlineStart": "12px",
    "paddingInlineEnd": "4px",
  },
  s30: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
  },
  s31: {
    "flexShrink": 0,
  },
  s32: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s33: {
    "color": "var(--warning-foreground)",
  },
  s34: {
    "color": "var(--muted-foreground)",
  },
  s35: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s36: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s37: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s38: {
    "marginBottom": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s39: {
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "6px",
  },
  s40: {
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s41: {
    "color": "var(--muted-foreground)",
  },
  s42: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s43: {
    "marginBottom": "4px",
    "color": "var(--muted-foreground)",
  },
  s44: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "2px",
    },
  },
  s45: {
    "color": "var(--muted-foreground)",
  },
  s46: {
    "color": "var(--foreground)",
  },
  s47: {
    "marginTop": "16px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  spinning: {
    "animationName": spin,
    "animationDuration": "1s",
    "animationTimingFunction": "linear",
    "animationIterationCount": "infinite",
    "@media (prefers-reduced-motion: reduce)": {
      "animationName": "none",
    },
    ":is(:root[data-berth-still] &)": {
      "animationName": "none",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// ComputersSection is Burf on more than one computer: add another (a join
// link), join from another, and the computers each box trusts, with a way to
// remove one.
export function ComputersSection() {
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const [inviting, setInviting] = useState(false);
  const [joining, setJoining] = useState(false);
  return (
    <SettingsPage
      title="Computers"
      description={
        <>
          Use Burf on another computer. Each pairs with your boxes with its own key, and they all work at once. <Code>burf invite</Code> and <Code>burf join</Code> do the same.
        </>
      }
    >
      <SettingsGroup>
        <SettingsRow label="Add another computer" description="A link that pairs another computer of yours with the boxes you choose. It works once per box, for ten minutes.">
          <span className={sx(paint.s0)}><Button size="xs" variant="outline"  disabled={boxes.length === 0} onClick={() => setInviting(true)}>
            Add another computer
          </Button></span>
        </SettingsRow>
        <SettingsRow label="Join from another computer" description="Paste a link made on your other computer to pair this one with its boxes.">
          <span className={sx(paint.s1)}><Button size="xs" variant="outline"  onClick={() => setJoining(true)}>
            Use a join link
          </Button></span>
        </SettingsRow>
      </SettingsGroup>

      {boxes.map((b) => (
        <BoxComputers key={b.name} box={b} />
      ))}

      <InviteDialog open={inviting} onOpenChange={setInviting} boxes={boxes} />
      <Dialog open={joining} onOpenChange={setJoining}>
        <DialogPopup anchored width="xl">
          {joining && (
            <JoinFlow
              variant="dialog"
              onDone={(paired) => {
                setJoining(false);
                if (paired.length) toastManager.add({ title: `Paired with ${boxList(paired)}`, type: "success" });
              }}
            />
          )}
        </DialogPopup>
      </Dialog>
    </SettingsPage>
  );
}

// BoxComputers lists the computers one box trusts.
function BoxComputers({ box }: { box: BoxStatus }) {
  const client = useStore((s) => s.client);
  const online = box.state === "online";
  const [list, setList] = useState<TrustedComputer[]>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  // A computer paired or removed, from any computer: read the list again.
  const changed = useEventLog((s) => s.events.find((e) => e.box === box.name && e.type.startsWith("client."))?.time);

  const load = useCallback(async () => {
    if (!client || !online) return;
    setLoading(true);
    try {
      setList(await computersApi.clients(client, box.name));
      setError(undefined);
    } catch (err) {
      // A 404 here is the route, not a computer: the box predates the list.
      setError(err instanceof ApiError && err.status === 404 ? "404 page not found" : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [client, online, box.name]);
  useEffect(() => void load(), [load, changed]);

  return (
    <SettingsGroup
      title={list ? `${box.name} · ${list.length === 1 ? "1 computer" : `${list.length} computers`}` : box.name}
      actions={
        online && (
          <Button size="icon-xs" variant="ghost" aria-label={`Read ${box.name}'s list again`} disabled={loading} onClick={() => void load()}>
            <RefreshCwIcon className={sx(loading && paint.spinning)} />
          </Button>
        )
      }
    >
      {!online ? (
        <p className={sx(paint.s2)}>{box.name} is {box.state}, so its list can't be read.</p>
      ) : error ? (
        <BoxError className={sx(paint.s3)} box={box.name} error={error} what="its paired computers" />
      ) : !list ? (
        <div className={sx(paint.s4)}>
          <Spinner  size="lg"/> Loading…
        </div>
      ) : (
        list.map((c) => <ComputerRow key={c.fingerprint} box={box.name} computer={c} onRemoved={load} />)
      )}
    </SettingsGroup>
  );
}

function ComputerRow({ box, computer, onRemoved }: { box: string; computer: TrustedComputer; onRemoved(): void }) {
  const [removing, setRemoving] = useState(false);
  const Icon = computer.you ? LaptopIcon : MonitorIcon;
  return (
    <div className={sx(paint.s5)}>
      <Icon aria-hidden className={sx(paint.s6)} />
      <div className={sx(paint.s7)}>
        <div className={sx(paint.s8)}>
          <span className={sx(paint.s9)}>{computer.name}</span>
          {computer.you && <span className={sx(paint.s10)}>This computer</span>}
        </div>
        <div className={sx(paint.s11)}>
          {computer.fingerprint.slice(0, 12)} · paired {ago(computer.paired_at)}
        </div>
      </div>
      {!computer.you && (
        <Button size="xs" variant="ghost"  onClick={() => setRemoving(true)} muted>
          Remove…
        </Button>
      )}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        destructive
        title={`Remove ${computer.name} from ${box}?`}
        description={`${computer.name} can no longer reach ${box}: its terminals, forwards and event streams there close at once. Agents and worktrees on ${box} keep running. To use ${box} on it again, add it from here with Add another computer.`}
        confirm="Remove"
        onConfirm={async () => {
          const client = useStore.getState().client;
          if (!client) return;
          try {
            await computersApi.removeClient(client, box, computer.name);
            toastManager.add({ title: `${computer.name} can no longer reach ${box}`, type: "success" });
            onRemoved();
          } catch (err) {
            toastManager.add({ title: `Couldn't remove ${computer.name}`, description: errorMessage(err), type: "error" });
          }
        }}
      />
    </div>
  );
}

// InviteDialog makes a join link: choose boxes, confirm what that gives
// away, then the link, its QR code and how long it lasts.
function InviteDialog({ open, onOpenChange, boxes }: { open: boolean; onOpenChange(open: boolean): void; boxes: BoxStatus[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup anchored width="xl">
        {open && <InviteFlow boxes={boxes} onClose={() => onOpenChange(false)} />}
      </DialogPopup>
    </Dialog>
  );
}

function InviteFlow({ boxes, onClose }: { boxes: BoxStatus[]; onClose(): void }) {
  const client = useStore((s) => s.client);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(boxes.filter((b) => b.state === "online").map((b) => b.name)));
  const [invite, setInvite] = useState<Invite>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const names = boxes.filter((b) => chosen.has(b.name)).map((b) => b.name);

  const make = async () => {
    if (!client || names.length === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      setInvite(await computersApi.invite(client, names));
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  };

  if (invite) return <InviteLink invite={invite} onBack={() => setInvite(undefined)} onAgain={() => void make()} again={busy} onClose={onClose} />;

  return (
    <>
      <StepHeader title="Add another computer" description="Choose the boxes the other computer should use. It pairs with each with its own key; this computer stays paired." />
      <DialogPanel inset="tight">
        <ul className={sx(paint.s12)} aria-label="Boxes">
          {boxes.map((b) => {
            const online = b.state === "online";
            return (
              <li key={b.name}>
                <label className={[sx(paint.s13), online ? sx(paint.s14) : sx(paint.s15)].filter(Boolean).join(" ")}>
                  <Checkbox
                    checked={chosen.has(b.name)}
                    disabled={!online}
                    onCheckedChange={(on) =>
                      setChosen((prev) => {
                        const next = new Set(prev);
                        if (on) next.add(b.name);
                        else next.delete(b.name);
                        return next;
                      })
                    }
                  />
                  <span className={sx(paint.s16)}>
                    <span className={sx(paint.s17)}>{b.name}</span>
                    <span className={sx(paint.s18)}>
                      {online ? [b.address, b.network && `via ${b.network}`].filter(Boolean).join(" · ") : `${b.state}: it can't make a code until it's back`}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {/* The confirmation is the step itself: what the link gives away. */}
        <div className={sx(paint.s19)}>
          <TriangleAlertIcon aria-hidden className={sx(paint.s20)} />
          <div className={sx(paint.s21)}>
            <p>{names.length ? <>This lets another computer control {boxList(names)}.</> : "Choose at least one box."}</p>
            <p className={sx(paint.s22)}>It can run commands, read code and open terminals there, as this computer can. Open the link only on a computer of yours, and don't post it in a chat or a ticket: anyone who has it can pair until it expires.</p>
          </div>
        </div>
        {error && <ErrorText className={sx(paint.s23)} text={error} />}
      </DialogPanel>
      <DialogFooter variant="bare" pad="edge">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={names.length === 0} loading={busy} onClick={() => void make()}>
          Make the link
        </Button>
      </DialogFooter>
    </>
  );
}

function InviteLink({ invite, again, onBack, onAgain, onClose }: { invite: Invite; again: boolean; onBack(): void; onAgain(): void; onClose(): void }) {
  const [svg, setSvg] = useState("");
  const left = useSecondsLeft(invite.expires);
  const expired = left === 0;
  useEffect(() => {
    QRCode.toString(invite.link, { type: "svg", margin: 1, errorCorrectionLevel: "L", color: { dark: "#16181bff", light: "#ffffffff" } }).then(setSvg, () => setSvg(""));
  }, [invite.link]);
  const copy = () =>
    navigator.clipboard.writeText(invite.link).then(
      () => toastManager.add({ type: "success", title: "Join link copied", description: "Paste it only on your other computer." }),
      () => toastManager.add({ type: "error", title: "Could not copy" }),
    );

  return (
    <>
      <StepHeader
        title="Open this on the other computer"
        description={
          <>
            In Burf there, choose <span className={sx(paint.s24)}>I already use Burf on another computer</span> (or Settings → Computers → Use a join link) and paste it. In a terminal: <Code>burf join '…'</Code>.
          </>
        }
        onBack={onBack}
        backLabel="Choose other boxes"
      />
      <DialogPanel inset="tight">
        <div className={sx(paint.s25)}>
          <div className={[sx(paint.s26), expired && sx(paint.s27)].filter(Boolean).join(" ")} aria-label="QR code of the join link" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className={sx(paint.s28)}>
            <div className={sx(paint.s29)}>
              <code className={sx(paint.s30)}>{invite.link}</code>
              <span className={sx(paint.s31)}><Button size="xs" variant="outline"  disabled={expired} onClick={() => void copy()}>
                <CopyIcon /> Copy
              </Button></span>
            </div>
            <div aria-live="polite" className={[sx(paint.s32), expired ? sx(paint.s33) : sx(paint.s34)].filter(Boolean).join(" ")}>
              {expired ? (
                <span className={sx(paint.s35)}>
                  This link has expired.
                  <Button size="xs" variant="outline" loading={again} onClick={onAgain}>
                    Make a new one
                  </Button>
                </span>
              ) : (
                <>
                  Works once per box · expires in <span className={sx(paint.s36)}>{countdown(left)}</span>
                </>
              )}
            </div>
            <div className={sx(paint.s37)}>
              <div className={sx(paint.s38)}>In the link</div>
              <div className={sx(paint.s39)}>
                {invite.boxes.map((b) => (
                  <span key={b.name} className={sx(paint.s40)}>
                    {b.name}
                    {b.network && <span className={sx(paint.s41)}> · {b.tailnet ?? b.network}</span>}
                  </span>
                ))}
              </div>
            </div>
            {invite.skipped.length > 0 && (
              <div className={sx(paint.s42)}>
                <div className={sx(paint.s43)}>Left out</div>
                <ul className={sx(paint.s44)}>
                  {invite.skipped.map((s) => (
                    <li key={s.name} className={sx(paint.s45)}>
                      <span className={sx(paint.s46)}>{s.name}</span>: {s.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className={sx(paint.s47)}>The QR code is the same link, for your phone's camera to copy across. The link holds a one-time code per box and the boxes' addresses and keys; never this computer's key.</p>
      </DialogPanel>
      <DialogFooter variant="bare" pad="edge">
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </>
  );
}
