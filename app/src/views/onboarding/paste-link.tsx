import * as stylex from "@stylexjs/stylex";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { laptopApi } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { findPairingLink, linkAddress, onTailnetAddress, unreachable } from "@/views/onboarding/pairing-link";

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
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--success-foreground)",
  },
  s6: {
    "width": "14px",
    "height": "14px",
  },
  s7: {
    "color": "var(--destructive-foreground)",
  },
  s8: {
    "color": "var(--muted-foreground)",
  },
  s9: {
    "color": "var(--foreground)",
    "textDecoration": {
      "default": "underline",
      ":hover": "none",
    },
  },
  s10: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
  },
  s11: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s12: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--foreground)",
  },
  s13: {
    "marginInlineStart": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s14: {
    "height": "20px",
    "width": "128px",
    "borderColor": {
      "default": "var(--input)",
      ":focus": "var(--ring)",
    },
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "transparent",
    "paddingLeft": "2px",
    "paddingRight": "2px",
    "color": {
      "default": "var(--foreground)",
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
    },
    "outline": "none",
  },
  s15: {
    "color": "var(--muted-foreground)",
  },

  s16: {
    textUnderlineOffset: 2,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// PasteLink pairs with a box from the link `berthd pair` (or the install
// script) printed there. Pasting the whole output is fine: the field keeps
// only the link. Enter pairs.
export function PasteLink({
  network,
  retry,
  autoFocus,
  onBusy,
  onPaired,
  onSignIn,
}: {
  network?: string;
  // Changing retry pairs again with what is in the field: after signing in
  // to the tailnet the box is on, say.
  retry: number;
  autoFocus?: boolean;
  onBusy(busy: boolean): void;
  onPaired(box: string): void;
  onSignIn(): void;
}) {
  const client = useStore((s) => s.client);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<{ message: string; away?: boolean }>();
  const field = useRef<HTMLInputElement>(null);
  const link = findPairingLink(text);
  const address = link ? linkAddress(link) : undefined;

  const pair = async () => {
    if (!client || busy) return;
    if (!link) {
      setError({ message: text.trim() ? "There's no pairing link in that. It starts with berth:// and is the last thing the install command prints." : "Paste the pairing link the box printed first." });
      return;
    }
    setBusy(true);
    onBusy(true);
    setError(undefined);
    try {
      const peer = await laptopApi.pair(client, link, name.trim(), network);
      await useStore.getState().refreshAll();
      setDone(peer.name);
      onPaired(peer.name);
    } catch (err) {
      const message = errorMessage(err);
      setError({ message, away: unreachable(message) });
      setBusy(false);
      onBusy(false);
    }
  };

  const tried = useRef(retry);
  useEffect(() => {
    if (retry === tried.current) return;
    tried.current = retry;
    void pair();
    // Only a new retry pairs; pair reads the latest field and network.
  }, [retry]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void pair();
        }}
        className={sx(paint.s0)}
      >
        <ChevronRightIcon aria-hidden className={sx(paint.s1)} />
        <input
          ref={field}
          autoFocus={autoFocus}
          value={text}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Pairing link"
          aria-invalid={error && !error.away ? true : undefined}
          placeholder="berth://…  paste the link it printed"
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            const found = findPairingLink(pasted);
            if (!found) return;
            // A pasted line or two of output: keep only the link. Newlines
            // would otherwise run the lines together in a one-line field.
            e.preventDefault();
            setText(found);
            setError(undefined);
          }}
          onChange={(e) => {
            setText(e.target.value);
            setError(undefined);
          }}
          className={sx(paint.s2)}
        />
        <Tip label={!link ? "Paste a pairing link first" : undefined}>
          <span className={sx(paint.s3)}><Button type="submit" size="xs"  disabled={!link || !!done} loading={busy && !done}>
            Pair
          </Button></span>
        </Tip>
      </form>
      <div aria-live="polite" className={sx(paint.s4)}>
        {done ? (
          <span className={sx(paint.s5)}>
            <CheckIcon className={sx(paint.s6)} /> Paired with {done}
          </span>
        ) : error ? (
          <div className={sx(paint.s7)}>
            {error.message}
            {error.away && address && (
              <span className={sx(paint.s8)}>
                {" "}
                {onTailnetAddress(address) ? `${address} is a tailnet address; if the box is on a tailnet this computer isn't signed in to, ` : "If the box is on another tailnet, "}
                <button type="button" className={[sx(paint.s9), sx(paint.s16)].filter(Boolean).join(" ")} onClick={onSignIn}>
                  sign in to that tailnet
                </button>
                {" and Burf tries again."}
              </span>
            )}
          </div>
        ) : link && address ? (
          <div className={sx(paint.s10)}>
            <span className={sx(paint.s11)}>
              Box at <span className={sx(paint.s12)}>{address}</span>
              {network ? ` through the ${network} tailnet` : ""}
            </span>
            <span className={sx(paint.s13)}>
              named
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void pair())}
                placeholder="after its hostname"
                aria-label="Name in Burf"
                spellCheck={false}
                disabled={busy}
                className={sx(paint.s14)}
              />
            </span>
          </div>
        ) : (
          <span className={sx(paint.s15)}>It works once, for ten minutes. Pasting everything it printed is fine.</span>
        )}
      </div>
    </div>
  );
}
