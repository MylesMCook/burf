import * as stylex from "@stylexjs/stylex";
import { BanIcon, ChevronRightIcon, ImagePlusIcon, RefreshCwIcon, RotateCcwIcon, SparklesIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { type BuiltinKind, BUILTINS, builtin } from "@/components/art/chat-backgrounds";
import { useRendered } from "@/components/conversation/chat-background";
import { toastError } from "@/components/error-note";
import { Tip } from "@/components/tip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BUILTIN_PRESET,
  type ChatBackground,
  DEFAULT_CHAT_BACKGROUND,
  EFFECTS,
  generatedBlob,
  type ImageGenerator,
  imageGenApi,
  instructionFor,
  keepImage,
  listImages,
  onImagesChanged,
  PICTURE_PRESET,
  removeImage,
  type StoredImageInfo,
} from "@/lib/chat-background";
import { type ChatWidth, setChatBackground, setPrefs, usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { Segmented } from "@/views/settings/controls";
import { SettingsGroup, SettingsRow, useSettingsRow } from "@/views/settings/rows";

const paint = stylex.create({
  anchor: {
    "scrollMarginTop": "16px",
  },
  s0: {
    "marginBottom": "8px",
    "display": "flex",
    "alignItems": "flex-end",
    "gap": "12px",
  },
  s1: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s2: {
    "fontWeight": 500,
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--card) 40%, transparent)",
    "transitionProperty": "box-shadow",
    "transitionDuration": "150ms",
    "transitionTimingFunction": "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  s5: {
    "boxShadow": "0 0 0 2px var(--ring)",
  },
  s6: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "padding": "12px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s7: {
    "display": "none",
  },
  s8: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "12px",
  },
  s9: {
    "width": "68px",
    "flexShrink": 0,
    "paddingTop": "16px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexWrap": "wrap",
    "gap": "8px",
  },
  s11: {
    "position": "relative",
  },
  s12: {
    "display": "flex",
    "height": "48px",
    "width": "76px",
    "alignItems": "center",
    "justifyContent": "center",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "outline": "none",
    "transitionProperty": "box-shadow, border-color",
    "transitionDuration": "150ms",
    "transitionTimingFunction": "cubic-bezier(0.4, 0, 0.2, 1)",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s13: {
    "borderColor": "var(--ring)",
    "boxShadow": "0 0 0 2px color-mix(in oklab, var(--ring) 60%, transparent)",
  },
  s14: {
    "borderColor": {
      ":hover": "color-mix(in oklab, var(--foreground) 25%, transparent)",
    },
  },
  s15: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s16: {
    "position": "relative",
    "display": "block",
    "width": "100%",
    "height": "100%",
  },
  s17: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "width": "100%",
    "height": "100%",
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
  },
  s18: {
    "imageRendering": "pixelated",
  },
  s19: {
    "opacity": 1,
  },
  s20: {
    "opacity": 0,
  },
  s21: {
    "position": "absolute",
    "top": "-6px",
    "right": "-6px",
    "width": "20px",
    "height": "20px",
    "borderRadius": "999px",
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 8%, transparent)",
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
    ":is(.group:hover &)": {
      "opacity": 1,
    },
  },
  s22: {
    "width": "12px",
    "height": "12px",
  },
  s23: {
    "position": "relative",
    "isolation": "isolate",
    "height": "250px",
    "overflow": "hidden",
    "backgroundColor": "var(--background)",
  },
  s24: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "display": "flex",
    "left": "50%",
    "transform": "translateX(-50%)",
    "width": "62%",
    "flexDirection": "column",
    "gap": "10px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "16px",
    "paddingBottom": "12px",
    "fontSize": "11px",
    "lineHeight": "1.625",
  },
  s25: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "10px",
    "overflow": "hidden",
  },
  s26: {
    "alignSelf": "flex-end",
    "borderRadius": "var(--radius-2xl)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "color": "var(--foreground)",
  },
  s27: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "alignSelf": "flex-start",
    "borderRadius": "var(--radius-lg)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "color": "var(--muted-foreground)",
  },
  s28: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s29: {
    "fontFamily": "var(--font-mono)",
  },
  s30: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--success)",
  },
  s31: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--destructive)",
  },
  s32: {
    "color": "var(--foreground)",
  },
  s33: {
    "borderRadius": "var(--radius-lg)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--foreground)",
  },
  s34: {
    "color": "var(--muted-foreground)",
  },
  s35: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--input)",
    "backgroundColor": {
      "default": "light-dark(var(--background), color-mix(in oklab, var(--input) 32%, transparent))",
    },
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--muted-foreground)",
  },
  s36: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "zIndex": -10,
  },
  s37: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "width": "100%",
    "height": "100%",
    "transitionProperty": "opacity",
    "transitionDuration": "300ms",
  },
  s38: {
    "imageRendering": "pixelated",
  },
  s39: {
    "opacity": 1,
  },
  s40: {
    "opacity": 0,
  },
  s41: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "left": "50%",
    "transform": "translateX(-50%)",
    "width": "68%",
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
  },
  s42: {
    "opacity": 1,
  },
  s43: {
    "opacity": 0,
  },
  s44: {
    "marginTop": "16px",
  },
  s45: {
    "opacity": 0.6,
  },
  s46: {
    "opacity": 0.6,
  },
  s47: {
    "width": "14px",
    "height": "14px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s48: {
    "transform": "rotate(90deg)",
  },
  s49: {
    "marginTop": "8px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--card) 40%, transparent)",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s50: {
    "display": "flex",
    "width": "224px",
    "alignItems": "center",
    "gap": "12px",
  },
  s51: {
    "width": "44px",
    "textAlign": "right",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s52: {
    "marginTop": "12px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "padding": "12px",
  },
  s53: {
    "marginBottom": "8px",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s54: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s55: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s56: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s57: {
    "marginTop": "8px",
    "width": "fit-content",
  },
  s58: {
    "marginTop": "8px",
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "6px",
  },
  s59: {
    "fontWeight": 400,
  },
  s60: {
    "marginTop": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s61: {
    "marginTop": "6px",
    "maxHeight": "112px",
    "overflow": "auto",
    "whiteSpace": "pre-wrap",
    "borderRadius": "var(--radius-lg)",
    "overflowWrap": "anywhere",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
    "lineHeight": "1.625",
  },
  s62: {
    "marginTop": "8px",
  },
  s63: {
    "marginTop": "12px",
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
  },
  s64: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s65: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Settings › Appearance › Chat background: what is behind conversations.
// Patterns and gradients are drawn in code in the theme's colours; scenes
// and pictures of your own (added or generated) are dithered into them. A
// preview shows a conversation over it, and every tile is drawn as it
// would be, with the current effects.

// ChatWidthSettings is how wide a conversation's column runs, in panes and
// in zen: code, tables and edits keep scrolling inside their own blocks.
export function ChatWidthSettings() {
  const width = usePrefs((p) => p.chatWidth);
  return (
    <SettingsGroup title="Chat">
      <SettingsRow label="Width" description="How wide conversations run. Full takes the pane's width.">
        <Segmented
          value={width}
          options={[
            { value: "narrow", label: "Narrow" },
            { value: "default", label: "Default" },
            { value: "wide", label: "Wide" },
            { value: "xwide", label: "Extra wide" },
            { value: "full", label: "Full" },
          ]}
          onChange={(chatWidth: ChatWidth) => setPrefs({ chatWidth })}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

const GROUPS: { kind: BuiltinKind; title: string }[] = [
  { kind: "pattern", title: "Patterns" },
  { kind: "gradient", title: "Gradients" },
  { kind: "scene", title: "Scenes" },
];

export function ChatBackgroundSettings() {
  const bg = usePrefs((p) => p.chatBackground);
  const [generating, setGenerating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const add = async (f: File) => {
    try {
      const image = await keepImage(f, { name: f.name });
      setChatBackground({ source: "image", image, ...PICTURE_PRESET });
    } catch (err) {
      toastError(err, { title: "Couldn't use that picture" });
    }
  };

  return (
    <section
      id="chat-background"
      className={sx(paint.anchor)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
        if (f) void add(f);
      }}
    >
      <div className={sx(paint.s0)}>
        <div className={sx(paint.s1)}>
          <h2 className={sx(paint.s2)}>Chat background</h2>
          <p className={sx(paint.s3)}>Behind conversations, in zen too, in your theme's colours and quiet enough to read over.</p>
        </div>
        {bg.source !== "none" && (
          <Button size="xs" variant="ghost" onClick={() => setChatBackground({ ...DEFAULT_CHAT_BACKGROUND })}>
            <RotateCcwIcon />
            Reset
          </Button>
        )}
      </div>
      <div className={[sx(paint.s4), dragging && sx(paint.s5)].filter(Boolean).join(" ")}>
        <Preview bg={bg} />
        <div className={sx(paint.s6)}>
          {GROUPS.map((g) => (
            <TileRow key={g.kind} title={g.title}>
              {g.kind === "pattern" && (
                <Tile label="None" selected={bg.source === "none"} onClick={() => setChatBackground({ source: "none" })}>
                  <TileWords icon={<BanIcon />}>None</TileWords>
                </Tile>
              )}
              {BUILTINS.filter((b) => b.kind === g.kind).map((b) => (
                <Tile key={b.id} label={b.name} selected={bg.source === "builtin" && bg.builtin === b.id} onClick={() => setChatBackground({ source: "builtin", builtin: b.id, ...(bg.source === "image" ? BUILTIN_PRESET : {}) })}>
                  <Thumb bg={{ ...bg, ...(bg.source === "image" ? BUILTIN_PRESET : {}), source: "builtin", builtin: b.id }} />
                </Tile>
              ))}
            </TileRow>
          ))}
          <TileRow title="Custom">
            <OwnImages selected={bg.source === "image" ? bg.image?.id : undefined} />
            <Tile label="Add a picture of your own, or drop one here" onClick={() => file.current?.click()}>
              <TileWords icon={<ImagePlusIcon />}>Add…</TileWords>
            </Tile>
            <Tile label="Generate one from a prompt" selected={generating} onClick={() => setGenerating((g) => !g)}>
              <TileWords icon={<SparklesIcon />}>Generate</TileWords>
            </Tile>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className={sx(paint.s7)}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void add(f);
              }}
            />
          </TileRow>
          {generating && <Generate onClose={() => setGenerating(false)} />}
        </div>
      </div>
      {bg.source !== "none" && <Effects bg={bg} />}
    </section>
  );
}

function TileRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className={sx(paint.s8)}>
      <div className={sx(paint.s9)}>{title}</div>
      <div className={sx(paint.s10)}>{children}</div>
    </div>
  );
}

// Tile is one background to pick, as a small thumbnail with its name in a tip.
function Tile({ label, selected, onClick, children, extra }: { label: string; selected?: boolean; onClick(): void; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className={[sx(paint.s11), "group"].filter(Boolean).join(" ")}>
      <Tip label={label}>
        <button
          type="button"
          aria-label={label}
          aria-pressed={selected}
          onClick={onClick}
          className={[sx(paint.s12), selected ? sx(paint.s13) : sx(paint.s14)].filter(Boolean).join(" ")}
        >
          {children}
        </button>
      </Tip>
      {extra}
    </div>
  );
}

function TileWords({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className={sx(paint.s15)}>
      {icon}
      {children}
    </span>
  );
}

// Thumb draws a background as it would look, at a tile's size: the same
// drawing as the chat, at half scale and a stronger strength, so a quiet
// pattern still shows in 76 px.
function Thumb({ bg }: { bg: ChatBackground }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { drawn, pixelated } = useRendered(wrap, canvas, { ...bg, strength: Math.min(1, bg.strength + 0.3) }, 0.5);
  return (
    <span ref={wrap} className={sx(paint.s16)}>
      <canvas ref={canvas} className={[sx(paint.s17), pixelated && sx(paint.s18), drawn ? sx(paint.s19) : sx(paint.s20)].filter(Boolean).join(" ")} />
    </span>
  );
}

// OwnImages are the pictures added or generated, newest first, each drawn
// as it would be and with a way to forget it.
function OwnImages({ selected }: { selected?: string }) {
  const bg = usePrefs((p) => p.chatBackground);
  const [images, setImages] = useState<StoredImageInfo[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void listImages()
        .then((all) => alive && setImages(all.map(({ blob: _blob, ...info }) => info)))
        .catch(() => undefined);
    load();
    const off = onImagesChanged(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  const forget = async (img: StoredImageInfo) => {
    await removeImage(img.id);
    const now = usePrefs.getState().chatBackground;
    if (now.source === "image" && now.image?.id === img.id) setChatBackground({ source: "none", image: undefined });
  };
  // A picture not chosen yet is shown as it would land: Burf's preset.
  return images.map((img) => (
    <Tile
      key={img.id}
      label={img.prompt ? `Generated: ${img.prompt}` : img.name}
      selected={selected === img.id}
      onClick={() => setChatBackground(selected === img.id ? {} : { source: "image", image: img, ...(bg.source === "image" ? {} : PICTURE_PRESET) })}
      extra={
        <Tip label="Remove this picture">
          <span className={sx(paint.s21)}><Button
            size="icon-xs"
            variant="secondary"
            aria-label={`Remove ${img.prompt ? "the generated picture" : img.name}`}
            onClick={() => void forget(img)}>
            <XIcon className={sx(paint.s22)} />
          </Button></span>
        </Tip>
      }
    >
      <Thumb bg={{ ...bg, ...(bg.source === "image" ? {} : PICTURE_PRESET), source: "image", image: img }} />
    </Tile>
  ));
}

// Preview is a conversation in miniature over the background, as it
// renders in the chat: the same drawing, scaled.
function Preview({ bg }: { bg: ChatBackground }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const on = bg.source !== "none" && (bg.source !== "image" || !!bg.image);
  return (
    <div ref={wrap} className={sx(paint.s23)} aria-label="Preview" role="img">
      {on && <PreviewLayer wrap={wrap} canvas={canvas} bg={bg} />}
      <div className={sx(paint.s24)}>
        <div className={sx(paint.s25)}>
          <div className={sx(paint.s26)}>Make the search page fast again</div>
          <div className={sx(paint.s27)}>
            <span className={sx(paint.s28)}>Edited</span> <span className={sx(paint.s29)}>lib/search.ts</span> <span className={sx(paint.s30)}>+12</span>
            <span className={sx(paint.s31)}>-4</span>
          </div>
          <p className={sx(paint.s32)}>The slow part was an unindexed join, so I added a trigram index:</p>
          <pre className={sx(paint.s33)}>create index on products using gin (name gin_trgm_ops);</pre>
          <p className={sx(paint.s34)}>p95 went from 840 ms to 95 ms.</p>
        </div>
        <div className={sx(paint.s35)}>Reply, or ask for something else</div>
      </div>
    </div>
  );
}

function PreviewLayer({ wrap, canvas, bg }: { wrap: React.RefObject<HTMLDivElement | null>; canvas: React.RefObject<HTMLCanvasElement | null>; bg: ChatBackground }) {
  // The preview is about 60% of a pane, so the design is too.
  const { drawn, sheet, pixelated } = useRendered(wrap, canvas, bg, 0.6);
  return (
    <div aria-hidden className={sx(paint.s36)} style={{ "--chat-sheet": `${Math.round(sheet * 100)}%` } as CSSProperties}>
      <canvas ref={canvas} className={[sx(paint.s37), pixelated && sx(paint.s38), drawn ? sx(paint.s39) : sx(paint.s40)].filter(Boolean).join(" ")} />
      <div data-glass={bg.original || undefined} className={[[sx(paint.s41), "cb-sheet cb-sheet-preview"].filter(Boolean).join(" "), drawn ? sx(paint.s42) : sx(paint.s43)].filter(Boolean).join(" ")} />
    </div>
  );
}

// Effects: strength, dither and tone; a picture's Advanced has showing it
// as it is, and how it fits.
function Effects({ bg }: { bg: ChatBackground }) {
  const custom = EFFECTS.some((k) => bg[k] !== DEFAULT_CHAT_BACKGROUND[k]);
  const picture = bg.source === "image" || (bg.source === "builtin" && builtin(bg.builtin).kind === "scene");
  const asIs = picture && bg.original;
  return (
    <div className={sx(paint.s44)}>
      <SettingsGroup
        title="Effects"
        actions={
          custom ? (
            <Button size="xs" variant="ghost" onClick={() => setChatBackground(Object.fromEntries(EFFECTS.map((k) => [k, DEFAULT_CHAT_BACKGROUND[k]])))}>
              Reset effects
            </Button>
          ) : undefined
        }
      >
        <SettingsRow label="Strength" description="How far it rises from the page, in the margins. Behind the conversation it always fades to a whisper.">
          <Amount value={bg.strength} max={1} onChange={(strength) => setChatBackground({ strength })} />
        </SettingsRow>
        <SettingsRow label="Dither" description={asIs ? "Off while the picture is shown as it is." : "Dots, like the harbour on a new agent: fine or coarse, or smooth."} dim={!!asIs}>
          <Segmented
            value={bg.dither}
            options={[
              { value: "fine", label: "Fine" },
              { value: "coarse", label: "Coarse" },
              { value: "off", label: "Smooth" },
            ]}
            onChange={(dither) => setChatBackground({ dither })}
          />
        </SettingsRow>
        <SettingsRow label="Tone" description={asIs ? "Off while the picture is shown as it is." : "Colour keeps a hint of its hues; Ink draws it in your theme's text colour."} dim={!!asIs}>
          <Segmented
            value={bg.tone}
            options={[
              { value: "colour", label: "Colour" },
              { value: "ink", label: "Ink" },
            ]}
            onChange={(tone) => setChatBackground({ tone })}
          />
        </SettingsRow>
      </SettingsGroup>
      {picture && <Advanced bg={bg} />}
    </div>
  );
}

function Advanced({ bg }: { bg: ChatBackground }) {
  const [open, setOpen] = useState(bg.original || bg.fit !== "cover" || bg.position !== "center");
  return (
    <Collapsible open={open} onOpenChange={setOpen} space>
      <CollapsibleTrigger look="quiet">
        <ChevronRightIcon className={[sx(paint.s47), open && sx(paint.s48)].filter(Boolean).join(" ")} />
        Advanced
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className={sx(paint.s49)}>
          <SettingsRow label="Show the picture as it is" description="No dither or toning. The conversation gets frosted glass behind it, as much as the picture needs.">
            <Switch checked={bg.original} onCheckedChange={(original) => setChatBackground({ original })} />
          </SettingsRow>
          {bg.source === "image" && (
            <SettingsRow label="Fit" description="Fill crops the picture to the pane; Fit shows all of it.">
              <Segmented
                value={bg.fit}
                options={[
                  { value: "cover", label: "Fill" },
                  { value: "contain", label: "Fit" },
                ]}
                onChange={(fit) => setChatBackground({ fit })}
              />
              <Segmented
                value={bg.position}
                label="Position"
                options={[
                  { value: "top", label: "Top" },
                  { value: "center", label: "Center" },
                  { value: "bottom", label: "Bottom" },
                ]}
                onChange={(position) => setChatBackground({ position })}
              />
            </SettingsRow>
          )}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

// Amount is a slider with its value beside it, a percentage unless told.
function Amount({ value, onChange, min = 0, max, step = 0.05, format = (v) => `${Math.round(v * 100)}%` }: { value: number; onChange(v: number): void; min?: number; max: number; step?: number; format?: (v: number) => string }) {
  const row = useSettingsRow();
  return (
    <div className={sx(paint.s50)}>
      <Slider aria-labelledby={row?.labelledBy} grow max={max} min={min} onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)} step={step} value={value} />
      <span className={sx(paint.s51)}>{format(value)}</span>
    </div>
  );
}

const IDEAS = ["A lighthouse in thick fog", "Tide pools seen from above", "A quiet marina at dusk, lamps on", "Rain on a harbour at night"];

// Generate makes a background from a prompt with an image generator on
// this computer, through the laptop agent. It says what will run, and runs
// it only when Generate is pressed.
function Generate({ onClose }: { onClose(): void }) {
  const client = useStore((s) => s.client);
  const [gens, setGens] = useState<ImageGenerator[] | "loading" | Error>("loading");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<number>();
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string>();
  const check = () => {
    if (!client) return setGens(new Error("Burf isn't connected to its agent on this computer."));
    setGens("loading");
    imageGenApi.list(client).then(setGens, (err: unknown) => setGens(err instanceof Error ? err : new Error(String(err))));
  };
  // Looks once, when opened (and again on Check again).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(check, [client]);
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  const gen = Array.isArray(gens) ? gens[0] : undefined;
  const ready = !!gen?.installed && gen.signed_in;
  const go = async () => {
    if (!client || !ready || !prompt.trim()) return;
    setBusy(Date.now());
    setNow(Date.now());
    setError(undefined);
    try {
      const img = await imageGenApi.generate(client, prompt.trim(), gen.id);
      const image = await keepImage(generatedBlob(img), { name: `${gen.name}: ${img.prompt}`, prompt: img.prompt });
      setChatBackground({ source: "image", image, ...PICTURE_PRESET });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(undefined);
    }
  };
  const shown = gen ? gen.command.map((a) => (a === "{prompt}" ? JSON.stringify(instructionFor(prompt.trim() || "…")) : a)).join(" ") : "";

  return (
    <div className={sx(paint.s52)}>
      <div className={sx(paint.s53)}>
        <SparklesIcon className={sx(paint.s54)} />
        <span className={sx(paint.s55)}>Generate a background</span>
        <Tip label="Close">
          <Button size="icon-xs" variant="ghost" aria-label="Close" onClick={onClose}>
            <XIcon />
          </Button>
        </Tip>
      </div>
      {gens === "loading" ? (
        <div className={sx(paint.s56)}>
          <Spinner  size="md"/> Looking for an image generator on this computer…
        </div>
      ) : gens instanceof Error || !gen || !ready ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>{gens instanceof Error ? "Can't look for an image generator" : !gen ? "No image generator found" : !gen.installed ? "Codex isn't installed" : "Codex isn't signed in"}</AlertTitle>
          <AlertDescription>
            <p>{gens instanceof Error ? gens.message : (gen?.note ?? "Burf generates backgrounds with Codex's CLI.")} Meanwhile, you can add a picture of your own.</p>
            <span className={sx(paint.s57)}><Button size="xs" variant="outline"  onClick={check}>
              <RefreshCwIcon />
              Check again
            </Button></span>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void go();
              }
            }}
            maxLength={1000}
            disabled={!!busy}
            placeholder="Describe the picture, such as a harbour at dusk with the lamps coming on"
            aria-label="Describe the picture"
            size="sm"
          />
          <div className={sx(paint.s58)}>
            {IDEAS.map((i) => (
              <span className={sx(paint.s59)}><Button key={i} size="xs" variant="outline" disabled={!!busy} onClick={() => setPrompt(i)} muted>
                {i}
              </Button></span>
            ))}
          </div>
          <div className={sx(paint.s60)}>
            Generate runs this on this computer, with your Codex account. Codex works read-only in an empty folder; only your prompt is sent.
          </div>
          <pre className={sx(paint.s61)}>{shown}</pre>
          {error && (
            <div className={sx(paint.s62)}><Alert variant="error">
              <TriangleAlertIcon />
              <AlertTitle>Couldn't generate it</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert></div>
          )}
          <div className={sx(paint.s63)}>
            <Button size="sm" disabled={!prompt.trim() || !!busy} loading={!!busy} onClick={() => void go()}>
              <SparklesIcon />
              Generate
            </Button>
            {busy ? <span className={sx(paint.s64)}>{gen.name} is drawing it, {Math.max(0, Math.round((now - busy) / 1000))} s; it usually takes 30 to 60 s.</span> : <span className={sx(paint.s65)}>It's kept on this computer, with the pictures above.</span>}
          </div>
        </>
      )}
    </div>
  );
}
