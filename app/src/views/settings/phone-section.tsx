import * as stylex from "@stylexjs/stylex";
import { CopyIcon, EllipsisIcon, RefreshCwIcon, SmartphoneIcon } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { errorMessage } from "@/lib/format";
import { BoxError } from "@/components/upgrade-box";
import { newNtfyTopic, type PairedBox, pairingLink, phoneApi, type PhoneStatus } from "@/lib/phone";
import { NONE, useStore } from "@/lib/store";
import { ConfirmDialog } from "@/views/settings/confirm";
import { Code, SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

const paint = stylex.create({
  s0: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s1: {
    "marginTop": "4px",
  },
  s2: {
    "color": "var(--destructive)",
  },
  s3: {
    "height": "96px",
  },
  s4: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "20px",
    "paddingBottom": "20px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "width": "20px",
    "height": "20px",
    "flexShrink": 0,
  },
  s6: {
    "display": "flex",
    "gap": "20px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
    "flexDirection": {
      "@media (max-width: 639px)": {
        "default": "column",
      },
    },
  },
  s7: {
    "width": "176px",
    "height": "176px",
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
  s8: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "10px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s9: {
    "fontWeight": 500,
  },
  s10: {
    "listStyleType": "decimal",
    "paddingLeft": "16px",
    "color": "var(--muted-foreground)",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "4px",
    },
  },
  s11: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "20px",
    "paddingBottom": "20px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s12: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
  },
  s13: {
    "display": "flex",
    "gap": "8px",
  },
  s14: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s15: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s16: {
    "display": "flex",
    "gap": "8px",
  },
  s17: {
    "justifyContent": "flex-start",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Settings → Phone: turn on each box's phone app, pair a phone with one QR
// code, and send "needs you" notifications through ntfy.
export function PhoneSection() {
  const client = useStore((s) => s.client);
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const online = useMemo(() => boxes.filter((b) => b.state === "online"), [boxes]);
  const [phone, setPhone] = useState<Record<string, PhoneStatus | { error: string; unsupported: true }>>({});
  const [busy, setBusy] = useState<string>();
  const [rotate, setRotate] = useState<string>();

  const load = useCallback(async () => {
    if (!client) return;
    const entries = await Promise.all(
      online.map(async (b) => {
        try {
          return [b.name, await phoneApi.status(client, b.name)] as const;
        } catch (err) {
          return [b.name, { error: errorMessage(err), unsupported: true as const }] as const;
        }
      }),
    );
    setPhone(Object.fromEntries(entries));
  }, [client, online]);
  useEffect(() => {
    void load();
  }, [load]);

  async function change(box: string, c: Parameters<typeof phoneApi.change>[2]) {
    if (!client) return;
    setBusy(box);
    try {
      const st = await phoneApi.change(client, box, c);
      setPhone((p) => ({ ...p, [box]: st }));
    } catch (err) {
      toastManager.add({ type: "error", title: `Phone access on ${box}`, description: errorMessage(err) });
    } finally {
      setBusy(undefined);
    }
  }

  const paired: PairedBox[] = online.flatMap((b) => {
    const st = phone[b.name];
    return st && "enabled" in st && st.enabled && st.url && st.token ? [{ name: b.name, url: st.url, token: st.token }] : [];
  });
  const link = pairingLink(paired);

  return (
    <SettingsPage
      title="Phone"
      description="See which agents need you and answer them from your phone, across your boxes. Each box serves the phone app on its tailnet address, so it works while this computer sleeps."
    >
      <SettingsGroup title="Boxes" description="Phone access is off until you turn it on. Only devices on your tailnet can reach it, and only with the code below.">
        {online.length === 0 && <p className={sx(paint.s0)}>No boxes are online.</p>}
        {online.map((b) => {
          const st = phone[b.name];
          const unsupported = st && "unsupported" in st;
          const on = !!st && "enabled" in st && st.enabled;
          return (
            <SettingsRow
              key={b.name}
              label={b.name}
              description={
                !st ? (
                  "Checking…"
                ) : unsupported ? (
                  <BoxError className={sx(paint.s1)} box={b.name} error={st.error} what="phone access" />
                ) : "error" in st && st.error ? (
                  <span className={sx(paint.s2)}>{st.error}</span>
                ) : on ? (
                  <Code>{st.url}</Code>
                ) : (
                  "Off"
                )
              }
            >
              {on && (
                <Menu>
                  <MenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label={`More for ${b.name}`} />}>
                    <EllipsisIcon />
                  </MenuTrigger>
                  <MenuPopup align="end">
                    <MenuItem onClick={() => setRotate(b.name)}>
                      <RefreshCwIcon /> New code…
                    </MenuItem>
                  </MenuPopup>
                </Menu>
              )}
              <Switch checked={on} disabled={!st || unsupported || busy === b.name} onCheckedChange={(v) => change(b.name, { enabled: v })} aria-label={`Phone access on ${b.name}`} />
            </SettingsRow>
          );
        })}
      </SettingsGroup>

      <SettingsGroup title="Pair your phone" description="One code pairs every box above that has phone access on.">
        <PairCode link={link} count={paired.length} />
      </SettingsGroup>

      <Notifications boxes={paired.map((p) => p.name)} phone={phone} onChange={change} />
      <div aria-hidden className={sx(paint.s3)} />

      <ConfirmDialog
        open={!!rotate}
        onOpenChange={(o) => !o && setRotate(undefined)}
        title={`New code for ${rotate}?`}
        description="Phones paired with the old code stop reaching this box until you scan the new one."
        confirm="Make a new code"
        onConfirm={async () => {
          if (rotate) await change(rotate, { rotate: true });
          setRotate(undefined);
        }}
      />
    </SettingsPage>
  );
}

function PairCode({ link, count }: { link?: string; count: number }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    if (!link) return setSvg("");
    QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#16181bff", light: "#ffffffff" } }).then(setSvg, () => setSvg(""));
  }, [link]);
  if (!link) {
    return (
      <div className={sx(paint.s4)}>
        <SmartphoneIcon className={sx(paint.s5)} />
        Turn on phone access for a box to get a pairing code.
      </div>
    );
  }
  return (
    <div className={sx(paint.s6)}>
      {/* The code holds the tokens, so it is shown here and nowhere else. */}
      <div className={sx(paint.s7)} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className={sx(paint.s8)}>
        <p className={sx(paint.s9)}>
          Scan with your phone's camera ({count} {count === 1 ? "box" : "boxes"})
        </p>
        <ol className={sx(paint.s10)}>
          <li>Your phone needs the Tailscale app, signed in to the same tailnet as the boxes.</li>
          <li>Scan the code, then add the page to your home screen (Share → Add to Home Screen).</li>
          <li>Anyone with this code can answer your agents. Make a new code if it leaks.</li>
        </ol>
        <div>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(link).then(
                () => toastManager.add({ type: "success", title: "Pairing link copied" }),
                () => toastManager.add({ type: "error", title: "Could not copy" }),
              );
            }}
          >
            <CopyIcon /> Copy link
          </Button>
        </div>
      </div>
    </div>
  );
}

function Notifications({ boxes, phone, onChange }: { boxes: string[]; phone: Record<string, PhoneStatus | { error: string; unsupported: true }>; onChange: (box: string, c: Parameters<typeof phoneApi.change>[2]) => Promise<void> }) {
  const current = boxes.map((b) => phone[b]).find((s) => s && "notify" in s && s.notify) as PhoneStatus | undefined;
  const [url, setUrl] = useState(current?.notify?.url ?? "");
  const [finished, setFinished] = useState(!!current?.notify?.on?.includes("finished"));
  useEffect(() => {
    if (current?.notify) {
      setUrl(current.notify.url);
      setFinished(!!current.notify.on?.includes("finished"));
    }
  }, [current?.notify]);
  const saved = !!current?.notify;
  const valid = /^https?:\/\/\S+\/\S+$/.test(url.trim());

  async function save() {
    for (const b of boxes) await onChange(b, { notify: { url: url.trim(), on: finished ? ["waiting", "finished"] : ["waiting"] } });
    toastManager.add({ type: "success", title: "Notifications on", description: `Send a test by waiting for an agent, or subscribe to the topic in ntfy first.` });
  }
  async function off() {
    for (const b of boxes) await onChange(b, { clear_notify: true });
    setUrl("");
  }

  return (
    <SettingsGroup
      title="Notifications"
      description={
        <>
          Boxes push to an <Code>ntfy</Code> topic when an agent needs you, and the ntfy app shows it on iOS and Android. Tapping it opens that agent here.
        </>
      }
    >
      {boxes.length === 0 ? (
        <p className={sx(paint.s11)}>Turn on phone access for a box first.</p>
      ) : (
        <div className={sx(paint.s12)}>
          <div className={sx(paint.s13)}>
            <Input value={url} onChange={(e) => setUrl(e.currentTarget.value)} placeholder="https://ntfy.sh/your-private-topic" mono text="xs" aria-label="ntfy topic URL" />
            <Button size="sm" variant="outline" onClick={() => setUrl(newNtfyTopic())}>
              New topic
            </Button>
          </div>
          <label className={sx(paint.s14)}>
            <Switch checked={finished} onCheckedChange={setFinished} />
            Also when an agent finishes its turn
          </label>
          <p className={sx(paint.s15)}>
            Install ntfy on your phone and subscribe to the same topic. The topic name is the only secret, so keep it long and random; anyone who knows it can read these notifications, which say which worktree needs you, never what the agent wrote.
          </p>
          <div className={[sx(paint.s16), !saved && sx(paint.s17)].filter(Boolean).join(" ")}>
            <Button size="sm" disabled={!valid} onClick={save}>
              {saved ? "Update" : "Turn on notifications"}
            </Button>
            {saved && (
              <Button size="sm" variant="ghost" onClick={off}>
                Turn off
              </Button>
            )}
          </div>
        </div>
      )}
    </SettingsGroup>
  );
}
