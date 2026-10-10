"use client";

import * as stylex from "@stylexjs/stylex";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { field, inkButton, mono, paper } from "./surfaces";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-2xl)",
    "padding": "12px",
    "maxWidth": "448px",
  },
  s1: {
    "width": "40px",
    "height": "40px",
    "flexShrink": 0,
    "borderRadius": "var(--radius-lg)",
    "objectFit": "cover",
  },
  s2: {
    "display": "flex",
    "width": "36px",
    "height": "36px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "cursor": {
      ":disabled": "default",
    },
    "opacity": {
      ":disabled": 0.4,
    },
  },
  s3: {
    "width": "16px",
    "height": "16px",
  },
  s4: {
    "marginLeft": "2px",
    "width": "16px",
    "height": "16px",
  },
  s5: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "6px",
  },
  s6: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13.5px",
    "fontWeight": 500,
  },
  s7: {
    "width": "100%",
    "cursor": {
      "default": "pointer",
      ":disabled": "default",
    },
    "accentColor": "var(--foreground)",
  },
  s8: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
  },
  s9: {
    "display": "none",
  },
  s10: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "flexShrink": 0,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "gap": "8px",
    "maxWidth": "576px",
  },
  s12: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
  },
  s13: {
    "display": "block",
    "maxWidth": "100%",
  },
  s14: {
    "height": "100%",
    "width": "100%",
    "objectFit": "contain",
  },
  s15: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
  },
  s16: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13.5px",
    "fontWeight": 500,
  },
  s17: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
  },
  s18: { "aspectRatio": "1" },
  s19: { "aspectRatio": "4 / 3" },
  s20: { "aspectRatio": "16 / 9" },
  s21: { "aspectRatio": "9 / 16" },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface AudioPlayerProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  src: string;
  title?: string | undefined;
  artwork?: string | undefined;
  durationMs?: number | undefined;
}

export interface VideoPlayerProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  src: string;
  poster?: string | undefined;
  title?: string | undefined;
  ratio?: "16:9" | "4:3" | "1:1" | "9:16" | "auto" | undefined;
  durationMs?: number | undefined;
}

function formatDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function useMediaDuration(
  mediaRef: RefObject<HTMLMediaElement | null>,
  src: string,
  durationMs?: number | undefined,
) {
  const [metadata, setMetadata] = useState<{ src: string; duration?: number }>({
    src,
  });

  // A server-rendered media element can load metadata before hydration attaches onLoadedMetadata.
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || media.readyState < HTMLMediaElement.HAVE_METADATA) return;
    if (Number.isFinite(media.duration) && media.duration >= 0) {
      setMetadata({ src, duration: media.duration });
    }
  }, [mediaRef, src]);
  const fallbackDuration =
    durationMs !== undefined && Number.isFinite(durationMs)
      ? Math.max(0, durationMs / 1000)
      : undefined;

  return {
    duration:
      metadata.src === src
        ? (metadata.duration ?? fallbackDuration)
        : fallbackDuration,
    setDurationFromMetadata: (duration: number) => {
      if (Number.isFinite(duration) && duration >= 0) {
        setMetadata({ src, duration });
      }
    },
  };
}

export function AudioPlayer({
  src,
  title,
  artwork,
  durationMs,
  className,
  ...props
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playback, setPlayback] = useState({
    src,
    currentTime: 0,
    playing: false,
    hasError: false,
  });
  const { duration, setDurationFromMetadata } = useMediaDuration(
    audioRef,
    src,
    durationMs,
  );
  const playbackState =
    playback.src === src
      ? playback
      : { src, currentTime: 0, playing: false, hasError: false };
  const { currentTime, playing, hasError } = playbackState;
  const update = (patch: Partial<Omit<typeof playback, "src">>) =>
    setPlayback((current) => ({
      ...(current.src === src
        ? current
        : { src, currentTime: 0, playing: false, hasError: false }),
      ...patch,
    }));
  const displayTitle = title ?? "Audio";
  const playbackLabel = title ? ` ${title}` : " audio";
  const durationLabel =
    duration === undefined ? "--:--" : formatDuration(duration);

  useEffect(() => {
    if (audioRef.current?.error) {
      setPlayback({ src, currentTime: 0, playing: false, hasError: true });
    }
  }, [src]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (playing) {
      audio.pause();
      update({ playing: false });
      return;
    }

    void audio.play().then(
      () => update({ playing: true }),
      () =>
        update(
          audio.error ? { hasError: true, playing: false } : { playing: false },
        ),
    );
  };

  return (
    <div
      data-slot="audio-player"
      className={[sx(paper, paint.s0), className].filter(Boolean).join(" ")}
      {...props}
    >
      {artwork ? (
        <img
          src={artwork}
          alt=""
          className={sx(paint.s1)}
        />
      ) : null}
      <button
        type="button"
        aria-label={`${playing ? "Pause" : "Play"}${playbackLabel}`}
        disabled={hasError}
        onClick={togglePlayback}
        className={sx(inkButton, paint.s2)}
      >
        {playing ? (
          <PauseIcon aria-hidden className={sx(paint.s3)} />
        ) : (
          <PlayIcon aria-hidden className={sx(paint.s4)} />
        )}
      </button>
      <div className={sx(paint.s5)}>
        <span className={sx(paint.s6)}>
          {displayTitle}
        </span>
        <input
          type="range"
          min={0}
          max={duration ?? 0}
          step={0.1}
          value={Math.min(currentTime, duration ?? 0)}
          aria-label="Seek"
          aria-valuetext={`${formatDuration(currentTime)} of ${durationLabel}`}
          disabled={hasError}
          onChange={(event) => {
            const nextTime = Number(event.currentTarget.value);
            if (!Number.isFinite(nextTime)) return;
            const resolvedTime = Math.min(nextTime, duration ?? nextTime);
            if (audioRef.current) audioRef.current.currentTime = resolvedTime;
            update({ currentTime: resolvedTime });
          }}
          className={sx(paint.s7)}
        />
      </div>
      <span className={sx(mono, paint.s8)}>
        {formatDuration(currentTime)} / {durationLabel}
      </span>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className={sx(paint.s9)}
        onLoadedMetadata={(event) => {
          setDurationFromMetadata(event.currentTarget.duration);
        }}
        onTimeUpdate={(event) =>
          update({ currentTime: event.currentTarget.currentTime })
        }
        onPlay={() => update({ playing: true })}
        onPause={() => update({ playing: false })}
        onError={() => update({ hasError: true, playing: false })}
      />
      {hasError ? (
        <span role="alert" className={sx(paint.s10)}>
          Can't play this audio
        </span>
      ) : null}
    </div>
  );
}

export function VideoPlayer({
  src,
  poster,
  title,
  ratio = "16:9",
  durationMs,
  className,
  ...props
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { duration, setDurationFromMetadata } = useMediaDuration(
    videoRef,
    src,
    durationMs,
  );
  const ratioStyle =
    ratio === "1:1"
      ? paint.s18
      : ratio === "4:3"
        ? paint.s19
        : ratio === "16:9"
          ? paint.s20
          : ratio === "9:16"
            ? paint.s21
            : false;

  return (
    <div
      data-slot="video-player"
      className={[sx(paint.s11), className].filter(Boolean).join(" ")}
      {...props}
    >
      <div className={sx(field, paint.s12, ratioStyle)}>
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          aria-label={title ?? "Video"}
          className={[sx(paint.s13), ratio !== "auto" && sx(paint.s14)].filter(Boolean).join(" ")}
          onLoadedMetadata={(event) => {
            setDurationFromMetadata(event.currentTarget.duration);
          }}
        />
      </div>
      {(title || duration !== undefined) && (
        <div className={sx(paint.s15)}>
          {title ? (
            <span className={sx(paint.s16)}>
              {title}
            </span>
          ) : null}
          {duration !== undefined ? (
            <span
              className={sx(mono, paint.s17)}
            >
              {formatDuration(duration)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
