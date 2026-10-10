"use client";

import * as stylex from "@stylexjs/stylex";
import {
  memo,
  useState,
  useEffect,
  useCallback,
  useRef,
  type PropsWithChildren,
} from "react";
import { createPortal } from "react-dom";
import {
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  ImageOffIcon,
  Loader2Icon,
  RefreshCwIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react";
import type {
  ImageMessagePart,
  ImageMessagePartComponent,
} from "@assistant-ui/react";
import { hostOf, safeHref } from "../utils/href";
import { fadeIn, pulse, spin } from "./surfaces";

const paint = stylex.create({
  s0: {
    "borderColor": "var(--border)",
    "borderWidth": 1,
    "borderStyle": "solid",
  },
  s1: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
  },
  s2: {
    "maxWidth": "256px",
  },
  s3: {
    "maxWidth": "384px",
  },
  s4: {
    "maxWidth": "512px",
  },
  s5: {
    "width": "100%",
  },
  s6: {
    "position": "relative",
  },
  s7: {
    "minHeight": "128px",
  },
  s8: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s9: {
    "color": "var(--muted-foreground)",
    "width": "32px",
    "height": "32px",
  },
  s10: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "display": "flex",
    "minHeight": "128px",
    "alignItems": "center",
    "justifyContent": "center",
    "padding": "16px",
  },
  s11: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
  },
  s12: {
    "color": "var(--muted-foreground)",
    "width": "32px",
    "height": "32px",
  },
  s13: {
    "display": "block",
    "height": "auto",
    "width": "100%",
    "objectFit": "contain",
  },
  s14: {
    "color": "var(--muted-foreground)",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "borderRadius": "var(--radius-sm)",
  },
  s16: {
    "backgroundColor": "var(--muted)",
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-sm)",
    "fontSize": "10px",
    "fontWeight": 500,
  },
  s17: {
    "color": {
      ":hover": "var(--foreground)",
    },
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s18: {
    "position": "absolute",
    "width": "1px",
    "height": "1px",
    "padding": 0,
    "margin": "-1px",
    "overflow": "hidden",
    "clip": "rect(0,0,0,0)",
    "whiteSpace": "nowrap",
    "borderWidth": 0,
  },
  s19: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s20: {
    "color": "var(--muted-foreground)",
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "cursor": "zoom-in",
  },
  s22: {
    "position": "fixed",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "zIndex": 50,
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "backgroundColor": "color-mix(in oklab, #000 80%, transparent)",
    "transitionDuration": "200ms",
  },
  s23: {
    "maxHeight": "90vh",
    "maxWidth": "90vw",
    "cursor": "zoom-out",
    "objectFit": "contain",
    "transitionDuration": "200ms",
  },
  s24: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": "color-mix(in oklab, var(--background) 80%, transparent)",
    "position": "absolute",
    "insetInlineEnd": "16px",
    "top": "16px",
    "cursor": "pointer",
    "borderRadius": "var(--radius-md)",
    "padding": "8px",
  },
  s25: {
    "width": "20px",
    "height": "20px",
  },
  s26: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "display": "flex",
    "minHeight": "128px",
    "alignItems": "center",
    "justifyContent": "center",
    "padding": "16px",
  },
  s27: {
    "color": "var(--muted-foreground)",
    "width": "32px",
    "height": "32px",
  },
  s28: {
    "position": "absolute",
    "width": "1px",
    "height": "1px",
    "padding": 0,
    "margin": "-1px",
    "overflow": "hidden",
    "clip": "rect(0,0,0,0)",
    "whiteSpace": "nowrap",
    "borderWidth": 0,
  },
  s29: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "display": "flex",
    "minHeight": "128px",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "padding": "16px",
    "textAlign": "center",
  },
  s30: {
    "color": "var(--muted-foreground)",
    "width": "32px",
    "height": "32px",
  },
  s31: {
    "fontSize": "14px",
    "lineHeight": "20px",
    "fontWeight": 500,
  },
  s32: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s33: {
    "backgroundColor": {
      ":hover": "var(--muted)",
    },
    "display": "inline-flex",
    "width": "28px",
    "height": "28px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "opacity": {
      ":disabled": 0.5,
    },
  },
  s34: {
    "width": "16px",
    "height": "16px",
  },
  s35: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "padding": "4px",
  },
  s36: {
    "backgroundColor": {
      ":hover": "var(--muted)",
    },
    "display": "inline-flex",
    "width": "28px",
    "height": "28px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
  },
  s37: {
    "width": "16px",
    "height": "16px",
  },
  s38: {
    "backgroundColor": {
      ":hover": "var(--muted)",
    },
    "display": "inline-flex",
    "width": "28px",
    "height": "28px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
  },
  s39: {
    "width": "16px",
    "height": "16px",
  },
  s40: {
    "position": "relative",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
  },
  s41: { "aspectRatio": "1" },
  s42: { "aspectRatio": "4 / 3" },
  s43: { "aspectRatio": "16 / 9" },
  s44: { "aspectRatio": "9 / 16" },
  s45: {
    "display": "block",
    "height": "100%",
    "width": "100%",
  },
  s46: { "objectFit": "cover" },
  s47: { "objectFit": "contain" },
  s48: { "visibility": "hidden" },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const extensionForMimeType = (mimeType?: string): string => {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
};

const dataUriToBlob = (dataUri: string): Blob | null => {
  const commaIndex = dataUri.indexOf(",");
  const meta = commaIndex >= 0 ? dataUri.slice(0, commaIndex) : dataUri;
  const data = commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : "";
  const mime =
    meta.match(/data:([^;]+)/i)?.[1]?.toLowerCase() ??
    "application/octet-stream";
  if (!/;base64/i.test(meta)) {
    const parts: BlobPart[] = [];
    let last = 0;
    for (const match of data.matchAll(/(?:%[\da-f]{2})+/gi)) {
      if (match.index > last) parts.push(data.slice(last, match.index));
      const run = match[0];
      const escaped = new Uint8Array(run.length / 3);
      for (let index = 0; index < escaped.length; index++) {
        escaped[index] = Number.parseInt(
          run.slice(index * 3 + 1, index * 3 + 3),
          16,
        );
      }
      parts.push(escaped);
      last = match.index + run.length;
    }
    parts.push(data.slice(last));
    return new Blob(parts, { type: mime });
  }
  let bytes: string;
  try {
    const base64 = data.replace(/%([\da-f]{2})/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
    bytes = atob(base64);
  } catch {
    return null;
  }
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

const mimeFromImage = (image: string): string | undefined =>
  image.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();

const defaultFilenameFromImage = (image: string): string => {
  const mime = mimeFromImage(image);
  if (mime) return `image.${extensionForMimeType(mime)}`;
  try {
    const path = new URL(image, document.baseURI).pathname;
    const encodedBasename = path.split("/").pop() ?? "";
    let basename = encodedBasename;
    try {
      basename = decodeURIComponent(encodedBasename);
    } catch {}
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(basename)) return basename;
  } catch {}
  return "image.png";
};

const downloadImagePart = (
  part: Pick<ImageMessagePart, "image" | "filename">,
): void => {
  if (typeof document === "undefined") return;
  const filename = part.filename ?? defaultFilenameFromImage(part.image);
  const isDataUri = /^data:/i.test(part.image);
  const blob = isDataUri ? dataUriToBlob(part.image) : null;
  if (isDataUri && !blob) return;
  const objectUrl = blob ? URL.createObjectURL(blob) : null;
  const href = objectUrl ?? part.image;
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 40_000);
};

const copyImagePart = async (
  part: Pick<ImageMessagePart, "image">,
): Promise<void> => {
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    typeof ClipboardItem === "undefined"
  ) {
    throw new Error("Clipboard API is not available in this environment.");
  }
  const blob = /^data:/i.test(part.image)
    ? dataUriToBlob(part.image)
    : await fetch(part.image).then((r) => r.blob());
  if (!blob) return;
  const mime = mimeFromImage(part.image) ?? blob.type ?? "image/png";
  await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
};

type ImageVariant = "outline" | "ghost" | "muted";
type ImageSize = "sm" | "default" | "lg" | "full";

function imageRootClass(
  variant: ImageVariant | null | undefined,
  size: ImageSize | null | undefined,
) {
  return [
    "aui-image-root",
    sx(
      paint.s40,
      variant === "ghost" ? false : variant === "muted" ? paint.s1 : paint.s0,
      size === "sm"
        ? paint.s2
        : size === "lg"
          ? paint.s4
          : size === "full"
            ? paint.s5
            : paint.s3,
    ),
  ]
    .filter(Boolean)
    .join(" ");
}

export type ImageRootProps = React.ComponentProps<"div"> & {
  variant?: ImageVariant | null | undefined;
  size?: ImageSize | null | undefined;
};

function ImageRoot({
  className,
  variant,
  size,
  children,
  ...props
}: ImageRootProps) {
  return (
    <div
      data-slot="image-root"
      data-variant={variant}
      data-size={size}
      className={[imageRootClass(variant, size), className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

type ImagePreviewProps = Omit<React.ComponentProps<"img">, "children"> & {
  containerClassName?: string | undefined;
  ratio?: "auto" | "1:1" | "4:3" | "16:9" | "9:16" | undefined;
  fit?: "cover" | "contain" | undefined;
};

function ImagePreview({
  className,
  containerClassName,
  ratio = "auto",
  fit = "contain",
  onLoad,
  onError,
  alt = "Image content",
  src,
  ...props
}: ImagePreviewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined);
  const [errorSrc, setErrorSrc] = useState<string | undefined>(undefined);

  const loaded = loadedSrc === src;
  const error = errorSrc === src;
  const fixedRatio = ratio !== "auto";
  const ratioStyle =
    ratio === "1:1"
      ? paint.s41
      : ratio === "4:3"
        ? paint.s42
        : ratio === "16:9"
          ? paint.s43
          : ratio === "9:16"
            ? paint.s44
            : false;

  useEffect(() => {
    const image = imgRef.current;
    if (typeof src !== "string" || !image?.complete) return;
    if (image.naturalWidth > 0) setLoadedSrc(src);
    else setErrorSrc(src);
  }, [src]);

  return (
    <div
      data-slot="image-preview"
      className={[sx(paint.s6, fixedRatio ? ratioStyle : paint.s7), containerClassName].filter(Boolean).join(" ")}
    >
      {!loaded && !error && (
        <div
          data-slot="image-preview-loading"
          className={sx(paint.s8)}
        >
          <ImageIcon className={sx(paint.s9, pulse)} />
        </div>
      )}
      {error ? (
        <div
          data-slot="image-preview-error"
          className={[sx(paint.s10), fixedRatio && sx(paint.s11)].filter(Boolean).join(" ")}
        >
          <ImageOffIcon className={sx(paint.s12)} />
        </div>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={[
            sx(
              fixedRatio ? paint.s45 : paint.s13,
              fixedRatio && (fit === "cover" ? paint.s46 : paint.s47),
              !loaded && paint.s48,
            ),
            className,
          ].filter(Boolean).join(" ")}
          onLoad={(e) => {
            if (typeof src === "string") setLoadedSrc(src);
            onLoad?.(e);
          }}
          onError={(e) => {
            if (typeof src === "string") setErrorSrc(src);
            onError?.(e);
          }}
          {...props}
        />
      )}
    </div>
  );
}

export type ImageSourceProps = {
  label?: string | undefined;
  url?: string | undefined;
  iconUrl?: string | undefined;
} & React.ComponentProps<"div">;

function ImageSource({
  className,
  label,
  url,
  iconUrl,
  ...props
}: ImageSourceProps) {
  const href = safeHref(url);
  const host = hostOf(url);
  const displayLabel = label || host;
  const [failedIconUrl, setFailedIconUrl] = useState<string | undefined>();

  if (!displayLabel) return null;

  const showIcon = iconUrl !== undefined && failedIconUrl !== iconUrl;

  return (
    <div
      data-slot="image-source"
      className={[sx(paint.s14), className].filter(Boolean).join(" ")}
      {...props}
    >
      {showIcon ? (
        <img
          data-slot="image-source-icon"
          src={iconUrl}
          alt=""
          className={sx(paint.s15)}
          onError={() => setFailedIconUrl(iconUrl)}
        />
      ) : (
        <span
          data-slot="image-source-icon-fallback"
          aria-hidden="true"
          className={sx(paint.s16)}
        >
          {displayLabel.charAt(0).toUpperCase()}
        </span>
      )}
      {href ? (
        <a
          data-slot="image-source-label"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={sx(paint.s17)}
        >
          {displayLabel}
          <span className={sx(paint.s18)}> (opens in a new tab)</span>
        </a>
      ) : (
        <span data-slot="image-source-label" className={sx(paint.s19)}>
          {displayLabel}
        </span>
      )}
    </div>
  );
}

function ImageFilename({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  if (!children) return null;

  return (
    <span
      data-slot="image-filename"
      className={[sx(paint.s20), className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}

type ImageZoomProps = PropsWithChildren<{
  src: string;
  alt?: string;
}>;

function ImageZoom({ src, alt = "Image preview", children }: ImageZoomProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = overlayRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables?.[0];
      const last = focusables?.[focusables.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.click();
          } else if (e.key === " ") {
            e.preventDefault();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " ") e.currentTarget.click();
        }}
        role="button"
        tabIndex={0}
        className={[sx(paint.s21), "aui-image-zoom-trigger"].filter(Boolean).join(" ")}
        aria-label="Click to zoom image"
      >
        {children}
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={overlayRef}
            data-slot="image-zoom-overlay"
            role="dialog"
            aria-modal="true"
            className={["aui-image-zoom-overlay", sx(paint.s22, fadeIn)].filter(Boolean).join(" ")}
            onClick={handleClose}
            aria-label="Zoomed image"
          >
            <img
              data-slot="image-zoom-content"
              src={src}
              alt={alt}
              className={["aui-image-zoom-content", sx(paint.s23, fadeIn)].filter(Boolean).join(" ")}
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
            />
            <button
              ref={closeRef}
              type="button"
              aria-label="Close zoomed image"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className={sx(paint.s24)}
            >
              <XIcon className={sx(paint.s25)} />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function ImageGenerating({ className }: { className?: string }) {
  return (
    <div
      data-slot="image-generating"
      className={[sx(paint.s26), className].filter(Boolean).join(" ")}
    >
      <Loader2Icon className={sx(paint.s27, spin)} />
      <span className={sx(paint.s28)}>Generating image…</span>
    </div>
  );
}

function ImageContentFilterError({
  className,
  reason,
}: {
  className?: string;
  reason?: string;
}) {
  return (
    <div
      data-slot="image-content-filter-error"
      className={[sx(paint.s29), className].filter(Boolean).join(" ")}
    >
      <ShieldAlertIcon className={sx(paint.s30)} />
      <p className={sx(paint.s31)}>Image could not be generated</p>
      {reason && <p className={sx(paint.s32)}>{reason}</p>}
    </div>
  );
}

export type ImageActionsProps = {
  part: ImageMessagePart;
  /**
   * Wire to your own generation call to show a regenerate button. The button
   * renders only when this is set and the part carries a `prompt`.
   */
  onRegenerate?: () => void | Promise<void>;
  className?: string;
};

function RegenerateButton({
  onRegenerate,
}: {
  onRegenerate: () => void | Promise<void>;
}) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setIsRegenerating(true);
        try {
          await onRegenerate();
        } catch {
        } finally {
          setIsRegenerating(false);
        }
      }}
      disabled={isRegenerating}
      data-slot="image-regenerate"
      aria-label="Regenerate image"
      className={sx(paint.s33)}
    >
      <RefreshCwIcon
        className={sx(paint.s34, isRegenerating && spin)}
      />
    </button>
  );
}

function ImageActions({ part, onRegenerate, className }: ImageActionsProps) {
  return (
    <div
      data-slot="image-actions"
      className={[sx(paint.s35), className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        onClick={() => downloadImagePart(part)}
        data-slot="image-download"
        aria-label="Download image"
        className={sx(paint.s36)}
      >
        <DownloadIcon className={sx(paint.s37)} />
      </button>
      <button
        type="button"
        onClick={() => {
          copyImagePart(part).catch(() => {});
        }}
        data-slot="image-copy"
        aria-label="Copy image"
        className={sx(paint.s38)}
      >
        <CopyIcon className={sx(paint.s39)} />
      </button>
      {onRegenerate && <RegenerateButton onRegenerate={onRegenerate} />}
    </div>
  );
}

const ImageImpl: ImageMessagePartComponent = (props) => {
  const { image, filename, status } = props;

  if (status?.type === "running") {
    return (
      <ImageRoot>
        <ImageGenerating />
        <ImageFilename>{filename}</ImageFilename>
      </ImageRoot>
    );
  }

  if (status?.type === "incomplete" && status.reason === "content-filter") {
    return (
      <ImageRoot>
        <ImageContentFilterError reason="The provider blocked this image." />
      </ImageRoot>
    );
  }

  return (
    <ImageRoot>
      <ImageZoom src={image} alt={filename || "Image content"}>
        <ImagePreview src={image} alt={filename || "Image content"} />
      </ImageZoom>
      <ImageFilename>{filename}</ImageFilename>
    </ImageRoot>
  );
};

const Image = memo(ImageImpl) as unknown as ImageMessagePartComponent & {
  Root: typeof ImageRoot;
  Preview: typeof ImagePreview;
  Source: typeof ImageSource;
  Filename: typeof ImageFilename;
  Zoom: typeof ImageZoom;
  Actions: typeof ImageActions;
  Generating: typeof ImageGenerating;
  ContentFilterError: typeof ImageContentFilterError;
};

Image.displayName = "Image";
Image.Root = ImageRoot;
Image.Preview = ImagePreview;
Image.Source = ImageSource;
Image.Filename = ImageFilename;
Image.Zoom = ImageZoom;
Image.Actions = ImageActions;
Image.Generating = ImageGenerating;
Image.ContentFilterError = ImageContentFilterError;

export {
  Image,
  ImageRoot,
  ImagePreview,
  ImageSource,
  ImageFilename,
  ImageZoom,
  ImageActions,
  ImageGenerating,
  ImageContentFilterError,
};
