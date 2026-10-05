import { BanIcon, ImagePlusIcon, RefreshCwIcon, RotateCcwIcon, SparklesIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { BUILTINS } from "@/components/art/chat-backgrounds";
import { useHarbourLight } from "@/components/art/harbour-art";
import { useRendered } from "@/components/conversation/chat-background";
import { toastError } from "@/components/error-note";
import { Tip } from "@/components/tip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type ChatBackground,
  DEFAULT_CHAT_BACKGROUND,
  EFFECTS,
  generatedBlob,
  type ImageGenerator,
  imageGenApi,
  instructionFor,
  keepImage,
  listImages,
  LOOKS,
  lookOf,
  onImagesChanged,
  removeImage,
  type StoredImageInfo,
} from "@/lib/chat-background";
import { setChatBackground, usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Segmented } from "@/views/settings/controls";
import { SettingsGroup, SettingsRow, useSettingsRow } from "@/views/settings/rows";

// Settings › Appearance › Chat background: what is behind conversations
// (none, a built-in, a picture of your own or one generated from a
// prompt), its effects, and a live preview of a conversation over it.

export function ChatBackgroundSettings() {
  const bg = usePrefs((p) => p.chatBackground);
  const [generating, setGenerating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const add = async (f: File) => {
    try {
      const image = await keepImage(f, { name: f.name });
      setChatBackground({ source: "image", image });
    } catch (err) {
      toastError(err, { title: "Couldn't use that picture" });
    }
  };

  return (
    <section
      id="chat-background"
      className="scroll-mt-4"
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
      <div className="mb-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-[13px] text-muted-foreground">Chat background</h2>
          <p className="mt-0.5 text-muted-foreground/80 text-xs">Behind conversations, in zen too. The conversation sits on frosted glass that keeps its text readable over any picture.</p>
        </div>
        {bg.source !== "none" && (
          <Button size="xs" variant="ghost" onClick={() => setChatBackground({ ...DEFAULT_CHAT_BACKGROUND })}>
            <RotateCcwIcon />
            Reset
          </Button>
        )}
      </div>
      <div className={cn("overflow-hidden rounded-xl border bg-card/40 transition-shadow", dragging && "ring-2 ring-ring")}>
        <Preview bg={bg} />
        <div className="border-t p-3">
          <div role="group" aria-label="Picture" className="flex flex-wrap gap-2">
            <Tile label="None" selected={bg.source === "none"} onClick={() => setChatBackground({ source: "none" })}>
              <TileWords icon={<BanIcon />}>None</TileWords>
            </Tile>
            {BUILTINS.map((b) => (
              <Tile key={b.id} label={b.name} selected={bg.source === "builtin" && bg.builtin === b.id} onClick={() => setChatBackground({ source: "builtin", builtin: b.id })}>
                <BuiltinThumb src={b.src} />
              </Tile>
            ))}
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
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void add(f);
              }}
            />
          </div>
          {generating && <Generate onClose={() => setGenerating(false)} />}
        </div>
      </div>
      {bg.source !== "none" && <Effects bg={bg} />}
    </section>
  );
}

// Tile is one picture to pick, as a small thumbnail with its name in a tip.
function Tile({ label, selected, onClick, children, extra }: { label: string; selected?: boolean; onClick(): void; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="group relative">
      <Tip label={label}>
        <button
          type="button"
          aria-label={label}
          aria-pressed={selected}
          onClick={onClick}
          className={cn(
            "flex h-12 w-[76px] items-center justify-center overflow-hidden rounded-lg border bg-muted/40 outline-none transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-ring",
            selected ? "border-ring ring-2 ring-ring/60" : "hover:border-foreground/25",
          )}
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
    <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground [&_svg]:size-4">
      {icon}
      {children}
    </span>
  );
}

function BuiltinThumb({ src }: { src: (l: ReturnType<typeof useHarbourLight>) => string }) {
  const light = useHarbourLight();
  return <img src={src(light)} alt="" draggable={false} className="size-full object-cover" />;
}

// OwnImages are the pictures added or generated, newest first, each with a
// way to forget it.
function OwnImages({ selected }: { selected?: string }) {
  const [images, setImages] = useState<(StoredImageInfo & { url: string })[]>([]);
  useEffect(() => {
    let urls: string[] = [];
    let alive = true;
    const load = () =>
      void listImages()
        .then((all) => {
          if (!alive) return;
          urls.forEach(URL.revokeObjectURL);
          const next = all.map(({ blob, ...info }) => ({ ...info, url: URL.createObjectURL(blob) }));
          urls = next.map((i) => i.url);
          setImages(next);
        })
        .catch(() => undefined);
    load();
    const off = onImagesChanged(load);
    return () => {
      alive = false;
      off();
      urls.forEach(URL.revokeObjectURL);
    };
  }, []);
  const forget = async (img: StoredImageInfo) => {
    await removeImage(img.id);
    const bg = usePrefs.getState().chatBackground;
    if (bg.source === "image" && bg.image?.id === img.id) setChatBackground({ source: "none", image: undefined });
  };
  return images.map((img) => {
    const { url, ...info } = img;
    return (
      <Tile
        key={img.id}
        label={img.prompt ? `Generated: ${img.prompt}` : img.name}
        selected={selected === img.id}
        onClick={() => setChatBackground({ source: "image", image: info })}
        extra={
          <Tip label="Remove this picture">
            <Button
              size="icon-xs"
              variant="secondary"
              aria-label={`Remove ${img.prompt ? "the generated picture" : img.name}`}
              onClick={() => void forget(info)}
              className="absolute -top-1.5 -right-1.5 size-5 rounded-full opacity-0 shadow-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            >
              <XIcon className="size-3" />
            </Button>
          </Tip>
        }
      >
        <img src={url} alt="" draggable={false} className="size-full object-cover" />
      </Tile>
    );
  });
}

// Preview is a conversation in miniature over the background, as it
// renders in the chat: the same drawing, scaled.
function Preview({ bg }: { bg: ChatBackground }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const on = bg.source !== "none" && (bg.source !== "image" || !!bg.image);
  return (
    <div ref={wrap} className="relative isolate h-[250px] overflow-hidden bg-background" aria-label="Preview" role="img">
      {on && <PreviewLayer wrap={wrap} canvas={canvas} bg={bg} />}
      <div className="absolute inset-y-0 left-1/2 flex w-[62%] -translate-x-1/2 flex-col gap-2.5 px-4 pt-4 pb-3 text-[11px] leading-relaxed">
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
          <div className="self-end rounded-xl bg-muted px-2.5 py-1 text-foreground">Make the search page fast again</div>
          <div className="flex items-center gap-1.5 self-start rounded-md bg-muted/40 px-2 py-1 text-muted-foreground">
            <span className="text-foreground/80">Edited</span> <span className="font-mono">lib/search.ts</span> <span className="font-mono text-success">+12</span>
            <span className="font-mono text-destructive">-4</span>
          </div>
          <p className="text-foreground">The slow part was an unindexed join, so I added a trigram index:</p>
          <pre className="rounded-md bg-muted px-2 py-1.5 font-mono text-[10px] text-foreground">create index on products using gin (name gin_trgm_ops);</pre>
          <p className="text-muted-foreground">p95 went from 840 ms to 95 ms.</p>
        </div>
        <div className="shrink-0 rounded-md border border-input bg-background px-2.5 py-1.5 text-muted-foreground dark:bg-input/32">Reply, or ask for something else</div>
      </div>
    </div>
  );
}

function PreviewLayer({ wrap, canvas, bg }: { wrap: React.RefObject<HTMLDivElement | null>; canvas: React.RefObject<HTMLCanvasElement | null>; bg: ChatBackground }) {
  // The preview is about 60% of a pane, so the effects' sizes are too.
  const { drawn, sheet, pixelated } = useRendered(wrap, canvas, bg, 0.6);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ "--chat-sheet": `${Math.round(sheet * 100)}%` } as CSSProperties}>
      <canvas ref={canvas} className={cn("absolute inset-0 size-full transition-opacity duration-300", pixelated && "[image-rendering:pixelated]", drawn ? "opacity-100" : "opacity-0")} />
      {bg.glass > 0 && <div className="cb-grain absolute inset-0" style={{ opacity: Math.min(0.35, bg.glass * 0.35) }} />}
      <div className={cn("cb-sheet absolute inset-y-0 left-1/2 w-[70%] -translate-x-1/2 transition-opacity", drawn ? "opacity-100" : "opacity-0")} />
    </div>
  );
}

// Effects are the background's look: a starting point, then each effect.
function Effects({ bg }: { bg: ChatBackground }) {
  const look = lookOf(bg);
  const custom = EFFECTS.some((k) => bg[k] !== DEFAULT_CHAT_BACKGROUND[k]);
  return (
    <div className="mt-4">
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
        <SettingsRow label="Look" description="A starting point; the controls below take it from there.">
          <Segmented value={look ?? ""} options={LOOKS.map((l) => ({ value: l.id, label: l.name }))} onChange={(id) => setChatBackground(LOOKS.find((l) => l.id === id)?.set ?? {})} />
        </SettingsRow>
        <SettingsRow label="Tone" description="Auto moves the picture into the theme's light, dark under a dark theme and light under a light one.">
          <Segmented
            value={bg.tone}
            options={[
              { value: "auto", label: "Auto" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "original", label: "Original" },
            ]}
            onChange={(tone) => setChatBackground({ tone })}
          />
        </SettingsRow>
        <SettingsRow label="Dim" description="Fades the picture into the page.">
          <Amount value={bg.dim} max={0.9} onChange={(dim) => setChatBackground({ dim })} />
        </SettingsRow>
        <SettingsRow label="Frosted glass" description="Blurs the picture and gives it a frosted grain.">
          <Amount value={bg.glass} max={1} onChange={(glass) => setChatBackground({ glass })} />
        </SettingsRow>
        <SettingsRow label="Pixelate" description="Draws the picture in blocks.">
          <Amount value={bg.pixelate} min={0} max={32} step={2} format={(v) => (v < 2 ? "Off" : `${v} px`)} onChange={(v) => setChatBackground({ pixelate: v < 2 ? 0 : v })} />
        </SettingsRow>
        <SettingsRow label="Dither" description="An ordered dither, like the harbour on a new agent: the picture's colours, or the theme's ink.">
          {bg.dither && (
            <Segmented
              value={bg.ditherColour}
              options={[
                { value: "picture", label: "Picture" },
                { value: "theme", label: "Theme" },
              ]}
              onChange={(ditherColour) => setChatBackground({ ditherColour })}
            />
          )}
          <Switch checked={bg.dither} onCheckedChange={(dither) => setChatBackground({ dither })} />
        </SettingsRow>
        {bg.dither && (
          <SettingsRow label="Dot size">
            <Amount value={bg.ditherSize} min={1} max={4} step={1} format={(v) => `${v} px`} onChange={(ditherSize) => setChatBackground({ ditherSize })} />
          </SettingsRow>
        )}
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
      </SettingsGroup>
    </div>
  );
}

// Amount is a slider with its value beside it, a percentage unless told.
function Amount({ value, onChange, min = 0, max, step = 0.05, format = (v) => `${Math.round(v * 100)}%` }: { value: number; onChange(v: number): void; min?: number; max: number; step?: number; format?: (v: number) => string }) {
  const row = useSettingsRow();
  return (
    <div className="flex w-56 items-center gap-3">
      <Slider value={value} min={min} max={max} step={step} onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)} aria-labelledby={row?.labelledBy} className="flex-1" />
      <span className="w-11 text-right text-muted-foreground text-xs tabular-nums">{format(value)}</span>
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
    if (!client) return setGens(new Error("Berth isn't connected to its agent on this computer."));
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
      setChatBackground({ source: "image", image });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(undefined);
    }
  };
  const shown = gen ? gen.command.map((a) => (a === "{prompt}" ? JSON.stringify(instructionFor(prompt.trim() || "…")) : a)).join(" ") : "";

  return (
    <div className="mt-3 rounded-lg border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <SparklesIcon className="size-3.5 text-muted-foreground" />
        <span className="flex-1 font-medium text-sm">Generate a background</span>
        <Tip label="Close">
          <Button size="icon-xs" variant="ghost" aria-label="Close" onClick={onClose}>
            <XIcon />
          </Button>
        </Tip>
      </div>
      {gens === "loading" ? (
        <div className="flex items-center gap-2 py-2 text-muted-foreground text-xs">
          <Spinner className="size-3.5" /> Looking for an image generator on this computer…
        </div>
      ) : gens instanceof Error || !gen || !ready ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>{gens instanceof Error ? "Can't look for an image generator" : !gen ? "No image generator found" : !gen.installed ? "Codex isn't installed" : "Codex isn't signed in"}</AlertTitle>
          <AlertDescription>
            <p>{gens instanceof Error ? gens.message : (gen?.note ?? "Berth generates backgrounds with Codex's CLI.")} Meanwhile, you can add a picture of your own.</p>
            <Button size="xs" variant="outline" className="mt-2 w-fit" onClick={check}>
              <RefreshCwIcon />
              Check again
            </Button>
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {IDEAS.map((i) => (
              <Button key={i} size="xs" variant="outline" disabled={!!busy} onClick={() => setPrompt(i)} className="font-normal text-muted-foreground">
                {i}
              </Button>
            ))}
          </div>
          <div className="mt-3 text-muted-foreground text-xs">
            Generate runs this on this computer, with your Codex account. Codex works read-only in an empty folder; only your prompt is sent.
          </div>
          <pre className="mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap rounded-md [overflow-wrap:anywhere] bg-muted px-2.5 py-2 font-mono text-[11px] text-foreground/85 leading-relaxed">{shown}</pre>
          {error && (
            <Alert variant="error" className="mt-2">
              <TriangleAlertIcon />
              <AlertTitle>Couldn't generate it</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" disabled={!prompt.trim() || !!busy} loading={!!busy} onClick={() => void go()}>
              <SparklesIcon />
              Generate
            </Button>
            {busy ? <span className="text-muted-foreground text-xs tabular-nums">{gen.name} is drawing it, {Math.max(0, Math.round((now - busy) / 1000))} s; it usually takes 30 to 60 s.</span> : <span className="text-muted-foreground text-xs">It's kept on this computer, with the pictures above.</span>}
          </div>
        </>
      )}
    </div>
  );
}
