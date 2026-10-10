import * as stylex from "@stylexjs/stylex";
import { ArrowDownIcon, ChevronsLeftRightIcon, MoveHorizontalIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import type { Art } from "@/lib/art/model";
import { overflow, type VdRegion, type VdShot, type VisualDiff } from "@/lib/art/vdiff";
import { useVdImage } from "@/lib/art/vdiff-img";
import { radius } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "grid",
    "width": "100%",
    "gridTemplateColumns": "repeat(2, minmax(0, 1fr))",
    "gap": "12px",
  },
  s1: {
    "minWidth": "0px",
  },
  s2: {
    "width": "100%",
  },
  s3: {
    "marginBottom": "6px",
    "display": "flex",
    "minHeight": "20px",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "8px",
    "whiteSpace": "nowrap",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "display": "none",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s5: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
  },
  s6: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
  },
  s7: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
  },
  s8: {
    "position": "relative",
    "width": "100%",
    "overflow": "hidden",
    "borderRadius": "var(--radius-md)",
    "boxShadow": "0 0 0 1px var(--border)",
  },
  s9: {
    "cursor": "ew-resize",
    "userSelect": "none",
  },
  s10: {
    "position": "absolute",
    "top": "0px",
    "left": "0px",
    "width": "100%",
    "backgroundColor": "color-mix(in oklab, #000 5%, transparent)",
  },
  s11: {
    "position": "absolute",
    "top": "0px",
    "left": "0px",
    "width": "100%",
    "userSelect": "none",
  },
  s12: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "alignItems": "flex-start",
    "justifyContent": "center",
    "backgroundColor": "repeating-linear-gradient(135deg,#e4e4e7 0 10px,#f4f4f5 10px 20px)",
    "paddingTop": "12%",
    "fontWeight": 500,
    "color": "#52525b",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s13: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "zIndex": 20,
  },
  s14: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "width": "2px",
    "backgroundColor": "#fff",
    "boxShadow": "0 0 0 1px rgba(0,0,0,0.25),0 0 12px rgba(0,0,0,0.25)",
  },
  s15: {
    "position": "sticky",
    "top": "40%",
    "marginLeft": "calc(17px * -1)",
    "display": "flex",
    "height": "34px",
    "width": "34px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, #000 15%, transparent)",
    "backgroundColor": "#fff",
    "color": "#18181b",
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s16: {
    "pointerEvents": "auto",
    "display": "flex",
    "width": "100%",
    "height": "100%",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px #2563eb",
    },
  },
  s17: {
    "width": "16px",
    "height": "16px",
  },
  s18: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
  },
  s19: {
    "position": "absolute",
    "top": "0px",
    "left": "0px",
    "width": "100%",
  },
  s20: {
    "position": "absolute",
    "top": "0px",
    "left": "0px",
    "width": "100%",
  },
  s21: {
    "pointerEvents": "none",
    "position": "absolute",
    "right": "0px",
    "zIndex": 10,
    "display": "flex",
    "alignItems": "flex-start",
    "justifyContent": "flex-end",
  },
  s22: {
    "height": "100%",
    "width": "4px",
    "backgroundColor": "color-mix(in oklab, #0ea5e9 70%, transparent)",
  },
  s23: {
    "position": "absolute",
    "top": "4px",
    "right": "8px",
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "whiteSpace": "nowrap",
    "borderRadius": "999px",
    "backgroundColor": "#0369a1",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "#fff",
  },
  s24: {
    "width": "12px",
    "height": "12px",
  },
  s25: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "right": "0px",
    "zIndex": 10,
    "width": "6px",
    "backgroundColor": "repeating-linear-gradient(180deg,#e11d48 0 8px,transparent 8px 14px)",
  },
  s26: {
    "position": "sticky",
    "top": "30%",
    "marginLeft": "calc(188px * -1)",
    "display": "inline-flex",
    "width": "180px",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "#be123c",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "#fff",
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s27: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s28: {
    "pointerEvents": "auto",
    "position": "absolute",
    "borderRadius": "2px",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "color-mix(in oklab, #71717a 60%, transparent)",
    "backgroundColor": "repeating-linear-gradient(135deg,rgba(113,113,122,0.35) 0 4px,transparent 4px 8px)",
  },
  s29: {
    "pointerEvents": "none",
    "position": "absolute",
    "zIndex": 10,
    "borderRadius": "3px",
  },
  s30: {
    "position": "absolute",
    "display": "inline-flex",
    "height": "18px",
    "minWidth": "18px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 600,
    "fontSize": "10.5px",
    "color": "#fff",
    "fontVariantNumeric": "tabular-nums",
  },
  s31: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "width": "8px",
    "height": "8px",
    "borderRadius": "999px",
  },
  s33: {
    "backgroundColor": "var(--muted-foreground)",
  },
  s34: {
    "backgroundColor": "#2563eb",
  },
  s35: {
    "marginBottom": "6px",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s36: {
    "width": "8px",
    "height": "8px",
    "borderRadius": "999px",
  },
  s37: {
    "backgroundColor": "var(--muted-foreground)",
  },
  s38: {
    "backgroundColor": "#2563eb",
  },
  s39: {
    "fontWeight": 500,
  },
  s40: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s41: {
    "position": "relative",
    "overflow": "hidden",
  },
  s42: {
    "position": "absolute",
    "maxWidth": "none",
    "userSelect": "none",
  },
  s43: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "backgroundColor": "color-mix(in oklab, #000 5%, transparent)",
  },
  s44: {
    "position": "absolute",
    "maxWidth": "none",
  },
  s45: {
    "position": "absolute",
    "maxWidth": "none",
  },
  s46: {
    "position": "absolute",
    "borderRadius": "3px",
  },

  s47: {
    "@container (min-width: 640px)": {
      display: "inline",
    },
  },
  s48: {
    touchAction: "none",
  },
  s49: {
    left: -1,
  },
  s50: {
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  s51: {
    boxShadow: "0 1px 3px 0 color-mix(in oklab, var(--foreground) 10%, transparent), 0 1px 2px -1px color-mix(in oklab, var(--foreground) 10%, transparent)",
  },
  s52: {
    top: -9,
    left: -9,
    boxShadow: "0 1px 3px 0 color-mix(in oklab, var(--foreground) 10%, transparent), 0 1px 2px -1px color-mix(in oklab, var(--foreground) 10%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The stage: one page at one size, before and after, drawn at the size it
// was shot (or smaller, to fit), with what changed on top. Every overlay is
// placed in the shot's own pixels as percentages, so it scales with it.
// The marks sit on screenshots, which are the app's own colours, not
// Burf's: they keep one blue, one red and one amber in either theme.

export type StageMode = "slider" | "side" | "flicker" | "onion";

export interface Overlays {
  heat: boolean;
  glow: number; // 0-1
  regions: boolean;
  focus?: number; // a region's index, drawn louder
}

export const REGION = "#2563eb";
const PAPER = "#f4f4f5";

type A = Pick<Art, "box" | "id" | "location" | "worktree">;

export function Stage({ art, v, shot, mode, o, wipe, setWipe, onion = 0.5, className }: { art: A; v: VisualDiff; shot: VdShot; mode: StageMode; o: Overlays; wipe: number; setWipe(n: number): void; onion?: number; className?: string }) {
  const W = shot.size;
  const before = shot.before?.img ? shot.before : undefined;
  const after = shot.after?.img ? shot.after : undefined;
  const H = Math.max(before?.h ?? 0, after?.h ?? 0, shot.viewport[1]);
  const flick = useFlicker(mode === "flicker");
  const base = v.base.kind === "baseline" ? `${v.base.label} baseline` : v.base.label;
  const dim = o.heat && shot.heat ? o.glow : 0;

  if (mode === "side")
    return (
      <div className={[sx(paint.s0), className].filter(Boolean).join(" ")} style={{ maxWidth: W * 2 + 12 }} data-vd-stage="side">
        {[
          { side: "Before", label: base, img: before, isAfter: false },
          { side: "After", label: v.head.label, img: after, isAfter: true },
        ].map((c) => (
          <div key={c.side} className={sx(paint.s1)}>
            <SideLabel side={c.side} label={c.label} />
            <Canvas W={W} H={H}>
              {c.img ? <Layer art={art} name={c.img.img} h={c.img.h!} H={H} /> : <Missing what={c.isAfter ? `Not on ${v.head.label}` : `Not on ${base}`} />}
              {c.isAfter ? <Marks art={art} shot={shot} o={o} W={W} H={H} /> : o.regions && <MaskMarks shot={shot} W={W} H={H} />}
            </Canvas>
          </div>
        ))}
      </div>
    );

  return (
    <div className={[sx(paint.s2), className].filter(Boolean).join(" ")} style={{ maxWidth: W }} data-vd-stage={mode}>
      <div className={sx(paint.s3)}>
        {mode === "slider" && (
          <>
            <Pill tone="before">← Before · {base}</Pill>
            {W >= 640 && <span className={[sx(paint.s4), sx(paint.s47)].filter(Boolean).join(" ")}>drag, or ←/→ on the handle</span>}
            <Pill tone="after">After · {v.head.label} →</Pill>
          </>
        )}
        {mode === "flicker" && (
          <Pill tone={flick ? "after" : "before"} live>
            {flick ? `After · ${v.head.label}` : `Before · ${base}`}
          </Pill>
        )}
        {mode === "onion" && <Pill tone="after">After at {Math.round(onion * 100)}% over before</Pill>}
      </div>
      <Canvas W={W} H={H} wipe={mode === "slider" ? setWipe : undefined}>
        {mode === "slider" && (
          <>
            {after ? <Layer art={art} name={after.img} h={after.h!} H={H} dim={dim} /> : <Missing what={`Not on ${v.head.label}`} />}
            <div className={sx(paint.s5)} style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)` }} data-vd-before>
              <div className={sx(paint.s6)} style={{ background: PAPER }} />
              {before ? <Layer art={art} name={before.img} h={before.h!} H={H} dim={dim} /> : <Missing what={`Not on ${base}`} />}
            </div>
          </>
        )}
        {mode === "flicker" && (flick ? after && <Layer art={art} name={after.img} h={after.h!} H={H} dim={dim} /> : before && <Layer art={art} name={before.img} h={before.h!} H={H} dim={dim} />)}
        {mode === "onion" && (
          <>
            {before && <Layer art={art} name={before.img} h={before.h!} H={H} dim={dim} />}
            {after && (
              <div className={sx(paint.s7)} style={{ opacity: onion }}>
                <Layer art={art} name={after.img} h={after.h!} H={H} dim={dim} />
              </div>
            )}
          </>
        )}
        <Marks art={art} shot={shot} o={o} W={W} H={H} />
        {mode === "slider" && <Handle wipe={wipe} setWipe={setWipe} />}
      </Canvas>
    </div>
  );
}

function useFlicker(on: boolean): boolean {
  const [b, setB] = useState(false);
  useEffect(() => {
    if (!on) return;
    // With reduced motion it doesn't flash: it changes once a second and a
    // half, slowly enough to read.
    const slow = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setInterval(() => setB((x) => !x), slow ? 1500 : 650);
    return () => window.clearInterval(t);
  }, [on]);
  return b;
}

// Canvas is the shot's coordinate space: W by H pixels, scaled to fit.
function Canvas({ W, H, wipe, children }: { W: number; H: number; wipe?: (n: number) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    wipe?.(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={ref}
      data-vd-canvas
      className={[sx(paint.s8), wipe && [sx(paint.s9), sx(paint.s48)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
      style={{ aspectRatio: `${W} / ${H}`, background: PAPER }}
      onPointerDown={
        wipe &&
        ((e) => {
          drag.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          at(e);
        })
      }
      onPointerMove={wipe && ((e) => drag.current && at(e))}
      onPointerUp={wipe && (() => (drag.current = false))}
    >
      {children}
    </div>
  );
}

function Layer({ art, name, h, H, dim = 0 }: { art: A; name?: string; h: number; H: number; dim?: number }) {
  const src = useVdImage(art, name);
  if (!src) return <div className={[sx(paint.s10), "burf-pulse"].filter(Boolean).join(" ")} style={{ height: `${(h / H) * 100}%` }} />;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      data-vd-img={name}
      className={sx(paint.s11)}
      style={{ height: `${(h / H) * 100}%`, filter: dim ? `grayscale(${0.6 + dim * 0.4}) contrast(${1 - dim * 0.35}) brightness(${1 + dim * 0.12})` : undefined, opacity: dim ? 1 - dim * 0.35 : 1 }}
    />
  );
}

export function Missing({ what }: { what: string }) {
  return <div className={sx(paint.s12)}>{what}</div>;
}

function Handle({ wipe, setWipe }: { wipe: number; setWipe(n: number): void }) {
  return (
    <div className={sx(paint.s13)} style={{ left: `${wipe}%` }}>
      <div className={[sx(paint.s14), sx(paint.s49)].filter(Boolean).join(" ")} />
      <div className={sx(paint.s15)}>
        <button
          type="button"
          aria-label="Before and after: drag, or use the arrow keys"
          role="slider"
          aria-valuenow={Math.round(wipe)}
          aria-valuemin={0}
          aria-valuemax={100}
          data-vd-handle
          className={sx(paint.s16)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setWipe(Math.max(0, wipe - 5));
            if (e.key === "ArrowRight") setWipe(Math.min(100, wipe + 5));
            if (e.key === "Home") setWipe(0);
            if (e.key === "End") setWipe(100);
          }}
        >
          <ChevronsLeftRightIcon className={sx(paint.s17)} />
        </button>
      </div>
    </div>
  );
}

const box = (r: { x: number; y: number; w: number; h: number }, W: number, H: number): React.CSSProperties => ({ left: `${(r.x / W) * 100}%`, top: `${(r.y / H) * 100}%`, width: `${(r.w / W) * 100}%`, height: `${(r.h / H) * 100}%` });

// Marks: the heatmap (a soft glow under the exact pixels), the regions,
// masked content, what only moved, and a page wider than the screen.
function Marks({ art, shot, o, W, H }: { art: A; shot: VdShot; o: Overlays; W: number; H: number }) {
  const heat = useVdImage(art, o.heat ? shot.heat : undefined);
  const heatH = shot.after?.h ?? H;
  const over = overflow(shot);
  return (
    <>
      {o.heat && heat && (
        <div data-vd-heat className={sx(paint.s18)}>
          <img src={heat} alt="" className={sx(paint.s19)} style={{ height: `${(heatH / H) * 100}%`, filter: "blur(6px) saturate(1.8) brightness(1.15)", opacity: Math.min(1, o.glow * 1.1) }} />
          <img src={heat} alt="" className={sx(paint.s20)} style={{ height: `${(heatH / H) * 100}%`, opacity: 0.25 + o.glow * 0.75 }} />
        </div>
      )}
      {o.regions && <MaskMarks shot={shot} W={W} H={H} />}
      {o.regions && shot.shift && (
        <div className={sx(paint.s21)} style={{ top: `${(shot.shift.y / H) * 100}%`, height: `${(shot.shift.h / H) * 100}%`, width: "30%" }}>
          <div className={[sx(paint.s22), sx(paint.s50)].filter(Boolean).join(" ")} />
          <span className={[sx(paint.s23), sx(paint.s51)].filter(Boolean).join(" ")}>
            <ArrowDownIcon className={sx(paint.s24)} />
            only moved {shot.shift.dy > 0 ? "+" : ""}
            {shot.shift.dy}px
          </span>
        </div>
      )}
      {o.regions && (shot.regions ?? []).map((r, i) => <RegionBox key={`${r.x}-${r.y}-${i}`} r={r} n={i + 1} W={W} H={H} loud={o.focus === i} />)}
      {over ? (
        <div className={sx(paint.s25)} data-vd-overflow>
          <span className={sx(paint.s26)}>
            <MoveHorizontalIcon className={sx(paint.s27)} />
            Scrolls sideways: {over}px wider than the screen
          </span>
        </div>
      ) : null}
    </>
  );
}

function MaskMarks({ shot, W, H }: { shot: VdShot; W: number; H: number }) {
  return (
    <>
      {(shot.masks ?? []).map(([x, y, w, h], i) => (
        <Tip key={`m${i}`} label="Masked: dynamic content, left out of the diff">
          <div role="img" aria-label="Masked: dynamic content, left out of the diff" data-vd-mask className={sx(paint.s28)} style={box({ x, y, w, h }, W, H)} />
        </Tip>
      ))}
    </>
  );
}

function RegionBox({ r, n, W, H, loud }: { r: VdRegion; n: number; W: number; H: number; loud?: boolean }) {
  return (
    <div data-vd-region={n} data-loud={loud || undefined} className={[sx(paint.s29), loud && "vd-loud"].filter(Boolean).join(" ")} style={{ ...box({ x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }, W, H), boxShadow: `0 0 0 ${loud ? 3 : 2}px ${REGION}, 0 0 0 ${loud ? 5 : 3}px rgba(255,255,255,0.7)` }}>
      <span className={[sx(paint.s30), sx(paint.s52)].filter(Boolean).join(" ")} style={{ background: REGION }}>
        {n}
      </span>
    </div>
  );
}

function Pill({ tone, live, children }: { tone: "before" | "after"; live?: boolean; children: React.ReactNode }) {
  return (
    <span className={sx(paint.s31)} aria-live={live ? "polite" : undefined}>
      <span className={[sx(paint.s32), tone === "before" ? sx(paint.s33) : sx(paint.s34)].filter(Boolean).join(" ")} />
      {children}
    </span>
  );
}

function SideLabel({ side, label }: { side: string; label: string }) {
  return (
    <div className={sx(paint.s35)}>
      <span className={[sx(paint.s36), side === "Before" ? sx(paint.s37) : sx(paint.s38)].filter(Boolean).join(" ")} />
      <span className={sx(paint.s39)}>{side}</span>
      <span className={sx(paint.s40)}>{label}</span>
    </div>
  );
}

// Crop is part of a shot, scaled to fill w by h: a page's top for a grid
// cell or a thumbnail, with the heat over it when asked.
export function Crop({ art, shot, r, side, w, h, heat = 0, outline, className }: { art: A; shot: VdShot; r: { x: number; y: number; w: number; h: number }; side: "before" | "after"; w: number; h: number; heat?: number; outline?: VdRegion; className?: string }) {
  const im = side === "before" ? shot.before : shot.after;
  const src = useVdImage(art, im?.img);
  const heatSrc = useVdImage(art, heat > 0 && side === "after" ? shot.heat : undefined);
  const W = shot.size;
  const k = Math.min(w / r.w, h / r.h, 3);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const left = w / 2 - cx * k;
  const top = h / 2 - cy * k;
  return (
    <div className={[sx(paint.s41), className].filter(Boolean).join(" ")} style={{ width: w, height: h, background: PAPER }}>
      {im?.img ? (
        src ? (
          <img src={src} alt="" draggable={false} className={sx(paint.s42)} style={{ left, top, width: W * k, filter: heat ? `grayscale(${heat * 0.7}) contrast(${1 - heat * 0.2})` : undefined, opacity: heat ? 1 - heat * 0.15 : 1 }} />
        ) : (
          <div className={[sx(paint.s43), "burf-pulse"].filter(Boolean).join(" ")} />
        )
      ) : (
        <Missing what={side === "before" ? "Not there before" : "Gone"} />
      )}
      {heatSrc && (
        <>
          <img src={heatSrc} alt="" className={sx(paint.s44)} style={{ left, top, width: W * k, filter: "blur(5px) saturate(1.8)", opacity: heat }} />
          <img src={heatSrc} alt="" className={sx(paint.s45)} style={{ left, top, width: W * k, opacity: 0.4 + heat * 0.6 }} />
        </>
      )}
      {outline && <div className={sx(paint.s46)} style={{ left: left + (outline.x - 3) * k, top: top + (outline.y - 3) * k, width: (outline.w + 6) * k, height: (outline.h + 6) * k, boxShadow: `0 0 0 2px ${REGION}` }} />}
    </div>
  );
}

