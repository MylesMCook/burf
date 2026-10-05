import { type CSSProperties, useEffect, useRef, useState } from "react";

import { type HarbourLight, useHarbourLight } from "@/components/art/harbour-art";
import { useActiveTheme } from "@/hooks/use-theme";
import { builtin } from "@/components/art/chat-backgrounds";
import { type ChatBackground as Bg, imageBlob } from "@/lib/chat-background";
import { render, type RGB, type ThemeColours } from "@/lib/chat-background-render";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

import "@/components/conversation/chat-background.css";

// ChatBackground is the picture behind a conversation (Settings ›
// Appearance › Chat background), and the reading sheet that keeps the
// conversation legible over it: a pane of frosted glass behind the
// column, as opaque as the picture needs for AA contrast
// (lib/chat-background-render.ts measures it). It sits behind the pane's
// content (the pane is `isolate`), takes no pointer, and draws once per
// change of picture, effect, theme or size, debounced.

export function ChatBackground() {
  const bg = usePrefs((p) => p.chatBackground);
  if (bg.source === "none" || (bg.source === "image" && !bg.image)) return null;
  return <Layer bg={bg} />;
}

function Layer({ bg }: { bg: Bg }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { drawn, sheet, pixelated } = useRendered(wrap, canvas, bg);
  return (
    <div ref={wrap} aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ "--chat-sheet": `${Math.round(sheet * 100)}%` } as CSSProperties}>
      <canvas ref={canvas} className={cn("absolute inset-0 size-full transition-opacity duration-300", pixelated && "[image-rendering:pixelated]", drawn ? "opacity-100" : "opacity-0")} />
      {bg.glass > 0 && <div className="cb-grain absolute inset-0" style={{ opacity: Math.min(0.35, bg.glass * 0.35) }} />}
      {/* The sheet follows the conversation's column: the pane's padding,
          the loops panel's room when there is room for it, 680px wide. */}
      <div className="absolute inset-y-0 right-6 left-6 @[1000px]:right-[max(24px,var(--berth-loops-w,0px))]">
        <div className="relative mx-auto h-full max-w-[680px]">
          <div className={cn("cb-sheet absolute inset-y-0 -inset-x-12 transition-opacity duration-300", drawn ? "opacity-100" : "opacity-0")} />
        </div>
      </div>
    </div>
  );
}

// openChatBackgroundSettings shows Settings › Appearance at its Chat
// background, for the pane menu's "Chat background…".
export function openChatBackgroundSettings() {
  useStore.getState().setView({ kind: "settings", section: "appearance" });
  window.setTimeout(() => document.getElementById("chat-background")?.scrollIntoView({ block: "start", behavior: "smooth" }), 80);
}

// useRendered draws bg into the canvas at the size of wrap, and again when
// it changes.
export function useRendered(wrap: React.RefObject<HTMLElement | null>, canvas: React.RefObject<HTMLCanvasElement | null>, bg: Bg, unit = 1) {
  const theme = useActiveTheme();
  const light = useHarbourLight();
  const [state, setState] = useState({ drawn: false, sheet: 0.85, pixelated: false });
  const key = sourceKey(bg, light);
  const effects = JSON.stringify([bg.fit, bg.position, bg.tone, bg.dim, bg.glass, bg.pixelate, bg.dither, bg.ditherSize, bg.ditherColour]);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv || !key) return;
    let alive = true;
    let timer = 0;
    let pending = false;
    let size = "";
    const draw = async () => {
      if (document.hidden) {
        pending = true;
        return;
      }
      pending = false;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h || `${w}x${h}` === size) return;
      const src = await loadSource(bg, light).catch(() => undefined);
      if (!alive || !src) return;
      size = `${w}x${h}`;
      const r = render(cv, src, w, h, window.devicePixelRatio || 1, bg, themeColours(el, theme.appearance === "dark"), unit);
      setState({ drawn: true, ...r });
    };
    const later = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void draw(), ms);
    };
    const onVisible = () => pending && !document.hidden && void draw();
    const ro = new ResizeObserver(() => later(150));
    ro.observe(el);
    document.addEventListener("visibilitychange", onVisible);
    // Sliders move in small steps: draw once they rest a moment.
    later(40);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // bg is read through key and effects; theme through its id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, effects, theme.id, theme.appearance, unit]);

  // Give the pixels back when the background goes.
  useEffect(() => {
    const cv = canvas.current;
    return () => {
      if (cv) cv.width = cv.height = 0;
    };
  }, [canvas]);
  return state;
}

const sourceKey = (bg: Bg, light: HarbourLight) => (bg.source === "builtin" ? `b:${builtin(bg.builtin).src(light)}` : bg.source === "image" && bg.image ? `i:${bg.image.id}` : "");

// The decoded picture is kept, one at a time, so moving a slider redraws
// without decoding it again.
let cached: { key: string; src: Promise<ImageBitmap | HTMLImageElement> } | undefined;

export function loadSource(bg: Bg, light: HarbourLight): Promise<ImageBitmap | HTMLImageElement> {
  const key = sourceKey(bg, light);
  if (cached?.key === key) return cached.src;
  const old = cached;
  void old?.src.then((s) => "close" in s && s.close(), () => undefined);
  const src = (async () => {
    if (bg.source === "image" && bg.image) {
      const blob = await imageBlob(bg.image.id);
      if (!blob) throw new Error("gone");
      return createImageBitmap(blob);
    }
    const img = new Image();
    img.src = builtin(bg.builtin).src(light);
    await img.decode();
    return img;
  })();
  cached = { key, src };
  src.catch(() => {
    if (cached?.key === key) cached = undefined;
  });
  return src;
}

// themeColours reads the page's background, text and muted text, through
// a canvas so any colour syntax a theme uses comes back as RGB.
export function themeColours(el: HTMLElement, dark: boolean): ThemeColours {
  const probe = document.createElement("span");
  el.appendChild(probe);
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const read = (v: string): RGB => {
    probe.style.color = `var(${v})`;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const out = { bg: read("--background"), fg: read("--foreground"), muted: read("--muted-foreground"), dark };
  probe.remove();
  return out;
}
