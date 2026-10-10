import * as stylex from "@stylexjs/stylex";
import { ExternalLinkIcon, NetworkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { laptopApi, type NetworkInfo } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { openUrl } from "@/lib/open-url";
import { useStore } from "@/lib/store";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "20px",
    },
  },
  s1: {
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "marginBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
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
  s5: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s6: {
    "width": "16px",
    "height": "16px",
    "color": "var(--muted-foreground)",
  },
  s7: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s8: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s9: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingTop": "20px",
  },
  s11: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s12: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "marginTop": "12px",
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s14: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "color": "var(--muted-foreground)",
  },
  s15: {
    "marginTop": "12px",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s16: {
    "marginTop": "8px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s17: {
    "marginTop": "8px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },

  s18: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// NetworksStep reaches boxes on a tailnet this computer is not part of, such
// as a personal one while the Mac is on work's: Burf joins it with its own
// node after a browser sign-in, then lists that tailnet's machines.
export function NetworksStep({ onPick }: { onPick(network: string): void }) {
  const client = useStore((s) => s.client);
  const [networks, setNetworks] = useState<NetworkInfo[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!client) return;
    laptopApi.networks(client).then(setNetworks, (err) => setError(plainError(err)));
  }, [client]);

  return (
    <div className={sx(paint.s0)}>
      {error && <ErrorText className={sx(paint.s1)} text={error} />}
      {networks === undefined && !error ? (
        <div className={sx(paint.s2)}>
          <Spinner  size="lg"/> Loading…
        </div>
      ) : (
        networks &&
        networks.length > 0 && (
          <div>
            <div className={sx(paint.s3)}>Joined</div>
            <ul className={[sx(paint.s4), sx(paint.s18)].filter(Boolean).join(" ")}>
              {networks.map((n) => (
                <li key={n.name} className={sx(paint.s5)}>
                  <NetworkIcon className={sx(paint.s6)} />
                  <div className={sx(paint.s7)}>
                    <div className={sx(paint.s8)}>{n.name}</div>
                    <div className={sx(paint.s9)}>
                      {n.tailnet ?? n.state}
                      {n.ips?.[0] ? ` · ${n.ips[0]}` : ""}
                    </div>
                  </div>
                  <Button size="xs" variant="outline" onClick={() => onPick(n.name)}>
                    Use this one
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
      <SignIn existing={networks?.map((n) => n.name) ?? []} onJoined={onPick} />
    </div>
  );
}

function SignIn({ existing, onJoined }: { existing: string[]; onJoined(network: string): void }) {
  const client = useStore((s) => s.client);
  const [name, setName] = useState("");
  const duplicate = existing.includes(name.trim());
  const [url, setUrl] = useState<string>();
  const [state, setState] = useState<"ready" | "waiting" | "failed">("ready");
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const start = async () => {
    if (!client || !name.trim()) return;
    abort.current = new AbortController();
    setState("waiting");
    setError(undefined);
    setUrl(undefined);
    try {
      const joined = await laptopApi.networkLogin(
        client,
        name.trim(),
        (u) => {
          setUrl(u);
          void openUrl(u);
        },
        abort.current.signal,
      );
      onJoined(joined.name);
    } catch (err) {
      if (abort.current?.signal.aborted) return;
      setError(plainError(err));
      setState("failed");
    }
  };

  return (
    <div className={sx(paint.s10)}>
      <div className={sx(paint.s11)}>Sign in to a tailnet</div>
      <p className={sx(paint.s12)}>Name it however you like; it's how Burf refers to that tailnet. A Tailscale sign-in page opens in your browser.</p>
      {state === "waiting" ? (
        <div className={sx(paint.s13)}>
          <Spinner  size="lg"/>
          <span className={sx(paint.s14)}>{url ? "Waiting for you to approve the sign-in in your browser…" : "Starting…"}</span>
          {url && (
            <Button size="xs" variant="ghost" onClick={() => void openUrl(url)}>
              <ExternalLinkIcon /> Open again
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              abort.current?.abort();
              setState("ready");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <form
          className={sx(paint.s15)}
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <Input size="sm" measure="cap56" value={name} onChange={(e) => setName(e.target.value)} placeholder="work, personal…" aria-label="Network name" aria-invalid={duplicate || undefined} />
          <Tip label={!name.trim() ? "Name the network first" : duplicate ? "There is a network by that name already" : undefined}>
            <Button size="sm" type="submit" disabled={!name.trim() || duplicate}>
              Sign in
            </Button>
          </Tip>
        </form>
      )}
      {duplicate && state !== "waiting" && <p className={sx(paint.s16)}>Burf already joined a tailnet called {name.trim()}. Browse it above, or pick another name.</p>}
      {error && <p className={sx(paint.s17)}>{error}</p>}
    </div>
  );
}
