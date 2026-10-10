import * as stylex from "@stylexjs/stylex";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { ArrowRightIcon, ArrowUpRightIcon, ChevronLeftIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WhatsNewArt } from "@/components/whats-new/art";
import { type Shower, showerFor, usePreloadArt } from "@/components/whats-new/show";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useArt } from "@/lib/art/model";
import { openDocs } from "@/lib/open-url";
import { useStore } from "@/lib/store";
import { closeWhatsNew, dismissNudge, openWhatsNew, useWhatsNew } from "@/lib/whats-new";
import type { Release, WhatsNewItem } from "@/lib/whats-new-model";
import { useWorkspaces } from "@/lib/workspaces";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s2: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
  },
  s3: {
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.375",
  },
  s5: {
    "borderRadius": "var(--radius-sm)",
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
    "textDecoration": "underline",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s6: {
    "display": "flex",
    "minHeight": "0px",
  },
  s7: {
    "display": {
      "default": "flex",
      "@media (max-width: 639px)": {
        "default": "none",
      },
    },
    "width": "248px",
    "flexShrink": 0,
    "flexDirection": "column",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
  },
  s8: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "1px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
  },
  s9: {
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "textAlign": "left",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--foreground) 5%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s10: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s11: {
    "marginTop": "auto",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "16px",
    "paddingBottom": "24px",
  },
  s12: {
    "position": "relative",
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s13: {
    "position": "absolute",
    "top": "8px",
    "right": "8px",
    "zIndex": 10,
  },
  s14: {
    "display": {
      "default": "none",
      "@media (max-width: 639px)": {
        "default": "block",
      },
    },
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "20px",
  },
  s15: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s16: {
    "marginLeft": "8px",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s17: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "20px",
    "paddingLeft": {
      "default": "32px",
      "@media (max-width: 639px)": {
        "default": "20px",
      },
    },
    "paddingRight": {
      "default": "32px",
      "@media (max-width: 639px)": {
        "default": "20px",
      },
    },
    "paddingTop": {
      "default": "48px",
      "@media (max-width: 639px)": {
        "default": "16px",
      },
    },
    "paddingBottom": "8px",
    "outline": "none",
  },
  s18: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s19: {
    "display": "flex",
    "minHeight": {
      "default": "6.75rem",
      "@media (max-width: 639px)": {
        "default": "0px",
      },
    },
    "flexDirection": "column",
    "gap": "6px",
  },
  s20: {
    "fontWeight": 600,
    "fontSize": "16px",
    "lineHeight": "24px",
  },
  s21: {
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "1.625",
  },
  s22: {
    "display": {
      "default": "none",
      "@media (max-width: 639px)": {
        "default": "flex",
      },
    },
  },
  s23: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "12px",
  },
  s24: {
    "display": {
      "@media (max-width: 639px)": {
        "default": "none",
      },
    },
  },
  s25: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s26: {
    "marginRight": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s27: {
    "visibility": "hidden",
  },
  s28: {
    "minWidth": "56px",
  },
  s29: {
    "minWidth": "56px",
  },
  s30: {
    "marginLeft": "8px",
    "marginRight": "8px",
    "marginBottom": "8px",
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "padding": "12px",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s31: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s32: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s33: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s34: {
    "marginTop": "calc(4px * -1)",
    "marginBottom": "calc(4px * -1)",
    "marginRight": "calc(6px * -1)",
  },
  s35: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.375",
  },
  s36: {
    "alignSelf": "flex-start",
  },

  s37: {
    textDecorationColor: { default: "color-mix(in oklab, var(--foreground) 30%, transparent)", ":hover": color.foreground },
    textUnderlineOffset: 2,
  },
  s38: {
    backgroundColor: { "[data-active]": "color-mix(in oklab, var(--foreground) 9%, transparent)" },
    fontWeight: { "[data-active]": 500 },
    color: { "[data-active]": color.foreground },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The What's new card (lib/whats-new.ts): the release's highlights one at
// a time, each with a picture of it in the app and a way there, listed
// down the side so the whole release reads at a glance. After an update a
// note at the foot of the sidebar opens it (WhatsNewNudge).

// useShowers is each item's Show me as things stand; it follows the
// worktree in front and the artifacts known.
function useShowers(items: WhatsNewItem[], open: boolean): (Shower | undefined)[] {
  usePreloadArt(open);
  useArt((s) => s.byWt);
  useWorkspaces((s) => s.current);
  useStore((s) => s.boxes);
  return items.map((i) => (i.show ? showerFor(i.show) : undefined));
}

export function WhatsNewDialog() {
  const { open, release } = useWhatsNew();
  if (!release) return null;
  return <SpotlightCard open={open} release={release} />;
}

function go(s: Shower) {
  closeWhatsNew();
  // After the dialog has given the keyboard back, so what opens keeps it.
  window.setTimeout(() => s.run(), 0);
}

// Hint is what an item offers without a Show me: its keys and where.
// Beside a Show me, the keys alone.
function Hint({ item, where, className }: { item: WhatsNewItem; where: boolean; className?: string }) {
  if (!item.keys) return null;
  return (
    <span className={[sx(paint.s0), className].filter(Boolean).join(" ")}>
      <span className={sx(paint.s1)}><Kbd>{item.keys}</Kbd></span>
      {where && item.where}
    </span>
  );
}

// Also is the release's smaller things, a line each.
function Also({ release, className }: { release: Release; className?: string }) {
  return (
    <div className={[sx(paint.s2), className].filter(Boolean).join(" ")}>
      <span className={sx(paint.s3)}>Also in this release</span>
      <ul className={sx(paint.s4)}>
        {release.also.map((a) => {
          const to = a.show && showerFor(a.show);
          return (
            <li key={a.text}>
              {a.text}{" "}
              {to && (
                <button type="button" onClick={() => go(to)} className={[sx(paint.s5), sx(paint.s37)].filter(Boolean).join(" ")}>
                  {to.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SpotlightCard({ open, release }: { open: boolean; release: Release }) {
  const items = release.items;
  const [at, setAt] = useState(0);
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setAt(0);
  }, [open]);
  const showers = useShowers(items, open);
  const item = items[at];
  const s = showers[at];
  const last = at === items.length - 1;
  const step = (d: number) => setAt((n) => Math.min(items.length - 1, Math.max(0, n + d)));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeWhatsNew()}>
      <DialogPopup
        ref={popup}
        initialFocus={popup}
        frame="notes"
        showCloseButton={false}
        data-testid="whats-new"
        onKeyDown={(e) => {
          // ← and → page from anywhere in the card; ↑ and ↓ move in its list.
          if (e.defaultPrevented || e.metaKey || e.altKey || e.ctrlKey) return;
          if ((e.target as HTMLElement).closest("input, textarea")) return;
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            step(e.key === "ArrowRight" ? 1 : -1);
          } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target === popup.current) {
            e.preventDefault();
            step(e.key === "ArrowDown" ? 1 : -1);
          }
        }}
      >
        <TabsPrimitive.Root value={at} onValueChange={(v) => setAt(Number(v))} orientation="vertical" className={sx(paint.s6)}>
          <div className={sx(paint.s7)}>
            <DialogHeader pad="notes">
              <DialogTitle size="base">What's new</DialogTitle>
              <DialogDescription mono size="xs">Burf {release.version}</DialogDescription>
            </DialogHeader>
            <TabsPrimitive.List activateOnFocus aria-label="Highlights" className={sx(paint.s8)}>
              {items.map((it, i) => (
                <TabsPrimitive.Tab
                  key={it.id}
                  value={i}
                  className={[sx(paint.s9), sx(paint.s38)].filter(Boolean).join(" ")}
                >
                  <span className={sx(paint.s10)}>{it.title}</span>
                </TabsPrimitive.Tab>
              ))}
            </TabsPrimitive.List>
            <Also release={release} className={sx(paint.s11)} />
          </div>
          <div className={sx(paint.s12)}>
            <DialogClose aria-label="Close" className={sx(paint.s13)} render={<Button size="icon" variant="ghost" />}>
              <XIcon />
            </DialogClose>
            <div className={sx(paint.s14)}>
              <span className={sx(paint.s15)}>What's new</span>
              <span className={sx(paint.s16)}>Burf {release.version}</span>
            </div>
            {items.map((it, i) => (
              <TabsPrimitive.Panel key={it.id} value={i} className={sx(paint.s17)} aria-label={it.title}>
                <div className={sx(paint.s18)}>
                  <WhatsNewArt art={it.art} />
                </div>
                <div className={sx(paint.s19)}>
                  <h3 className={sx(paint.s20)}>{it.title}</h3>
                  <p className={sx(paint.s21)}>{it.body}</p>
                </div>
                {/* Narrow, the list is hidden: the smaller things follow the last. */}
                {i === items.length - 1 && <Also release={release} className={sx(paint.s22)} />}
              </TabsPrimitive.Panel>
            ))}
            <DialogFooter variant="bare" pad="notes">
              <div className={sx(paint.s23)}>
                {s && (
                  <Button size="sm" onClick={() => go(s)} data-testid="whats-new-show">
                    {s.label}
                    <ArrowRightIcon />
                  </Button>
                )}
                <Hint item={item} where={!s} className={sx(paint.s24)} />
                {!s && !item.keys && item.docs && (
                  <Button size="sm" variant="outline" onClick={() => void openDocs(item.docs)}>
                    Read the guide
                    <ArrowUpRightIcon />
                  </Button>
                )}
              </div>
              <div className={sx(paint.s25)}>
                <span className={sx(paint.s26)} aria-hidden>
                  {at + 1} / {items.length}
                </span>
                <span className={at === 0 ? sx(paint.s27) : undefined}><Button size="icon-sm" variant="ghost" aria-label="Previous"  onClick={() => step(-1)}>
                  <ChevronLeftIcon />
                </Button></span>
                {last ? (
                  <span className={sx(paint.s28)}>
                    <DialogClose render={<Button size="sm" variant="ghost" />}>Done</DialogClose>
                  </span>
                ) : (
                  <span className={sx(paint.s29)}><Button size="sm" variant="ghost"  onClick={() => step(1)}>
                    Next
                  </Button></span>
                )}
              </div>
            </DialogFooter>
          </div>
        </TabsPrimitive.Root>
      </DialogPopup>
    </Dialog>
  );
}

// WhatsNewNudge is the note at the foot of the sidebar after an update.

export function WhatsNewNudge() {
  const { nudge, release } = useWhatsNew();
  if (!nudge || !release) return null;
  const [a, b] = release.items;
  return (
    <div className={sx(paint.s30)} data-testid="whats-new-nudge" role="region" aria-label="What's new">
      <div className={sx(paint.s31)}>
        <div className={sx(paint.s32)}>
          <span className={sx(paint.s33)}>New in Burf {release.version}</span>
          <span className={sx(paint.s34)}><Button size="icon-xs" variant="ghost" aria-label="Dismiss"  onClick={dismissNudge}>
            <XIcon />
          </Button></span>
        </div>
        <span className={sx(paint.s35)}>
          {a.title}, {b.title.toLowerCase()} and more.
        </span>
      </div>
      <span className={sx(paint.s36)}><Button size="xs" variant="outline"  onClick={() => openWhatsNew("update", release)}>
        See what's new
      </Button></span>
    </div>
  );
}
