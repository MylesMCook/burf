"use client";

import * as stylex from "@stylexjs/stylex";
import { memo, type FC } from "react";
import {
  FileIcon,
  FileTextIcon,
  ImageIcon,
  MusicIcon,
  VideoIcon,
  BracesIcon,
  DownloadIcon,
} from "lucide-react";
import type { FileMessagePartComponent } from "@assistant-ui/react";
import { AudioPlayer, VideoPlayer } from "./media-player";

const paint = stylex.create({
  s0: {
    "borderColor": "var(--border)",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--muted) 50%, transparent)",
    },
    "borderWidth": 1,
    "borderStyle": "solid",
  },
  s1: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--muted) 50%, transparent)",
    },
  },
  s2: {
    "backgroundColor": {
      "default": "color-mix(in oklab, var(--muted) 50%, transparent)",
      ":hover": "color-mix(in oklab, var(--muted) 70%, transparent)",
    },
  },
  s3: {
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "fontSize": "16px",
    "lineHeight": "24px",
  },
  s6: {
    "color": "var(--muted-foreground)",
    "flexShrink": 0,
  },
  s7: {
    "width": "20px",
    "height": "20px",
  },
  s8: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s9: {
    "color": "var(--muted-foreground)",
    "flexShrink": 0,
  },
  s10: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--accent-foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "padding": "4px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s11: {
    "width": "16px",
    "height": "16px",
  },
  s12: {
    "width": "100%",
  },
  s13: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "gap": "8px",
    "maxWidth": "576px",
  },
  s14: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "justifyContent": "flex-end",
    "gap": "8px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
  },
  s15: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "fontSize": "11px",
  },
  s16: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "2px",
  },
  s17: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s18: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-lg)",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type FileVariant = "outline" | "ghost" | "muted";
type FileSize = "sm" | "default" | "lg";

function fileRootClass(
  variant: FileVariant | null | undefined,
  size: FileSize | null | undefined,
) {
  return [
    "aui-file-root",
    sx(
      paint.s18,
      variant === "ghost" ? paint.s1 : variant === "muted" ? paint.s2 : paint.s0,
      size === "sm" ? paint.s3 : size === "lg" ? paint.s5 : paint.s4,
    ),
  ]
    .filter(Boolean)
    .join(" ");
}

function getMimeTypeIcon(mimeType: string): FC<{ className?: string }> {
  const type = mimeType.toLowerCase();
  if (type.startsWith("image/")) {
    return ImageIcon;
  }
  if (type === "application/pdf") {
    return FileTextIcon;
  }
  if (type === "application/json") {
    return BracesIcon;
  }
  if (type.startsWith("text/")) {
    return FileTextIcon;
  }
  if (type.startsWith("audio/")) {
    return MusicIcon;
  }
  if (type.startsWith("video/")) {
    return VideoIcon;
  }
  return FileIcon;
}

export type FileDataKind = "data-uri" | "url" | "base64" | "id";

function getFileDataKind(
  data: string,
  sourceType?: "url" | "id",
): FileDataKind {
  if (sourceType === "url" && /^data:/i.test(data)) return "data-uri";
  if (sourceType) return sourceType;
  if (/^data:/i.test(data)) return "data-uri";
  if (/^(https?:\/\/|blob:)/i.test(data)) return "url";
  return "base64";
}

function isUnsafeScheme(data: string): boolean {
  return (
    /^[a-z][a-z\d+.-]*:/i.test(data) &&
    !/^(data:|https?:\/\/|blob:)/i.test(data)
  );
}

function getFileHref(
  data: string,
  mimeType: string,
  sourceType?: "url" | "id",
): string | null {
  if (isUnsafeScheme(data)) return null;
  const kind = getFileDataKind(data, sourceType);
  if (kind === "id") return null;
  if (kind === "data-uri") return /^data:[^,]*,/i.test(data) ? data : null;
  if (kind === "url") return /^(https?:\/\/|blob:)/i.test(data) ? data : null;
  return `data:${mimeType};base64,${data}`;
}

function getBase64PayloadSize(payload: string): number {
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const firstNonBase64 = payload.search(/[^A-Za-z\d+/]/);
  if (
    (firstNonBase64 !== -1 && firstNonBase64 !== payload.length - padding) ||
    payload.length % 4 === 1 ||
    (padding > 0 && payload.length % 4 !== 0)
  ) {
    return 0;
  }
  return Math.floor((payload.length * 3) / 4) - padding;
}

function getBase64Size(base64: string): number {
  const payload = /[\t\n\f\r ]/.test(base64)
    ? base64.replace(/[\t\n\f\r ]/g, "")
    : base64;
  return getBase64PayloadSize(payload);
}

function getDataUrlSize(data: string): number {
  const fragment = data.indexOf("#");
  const end = fragment < 0 ? data.length : fragment;
  const comma = data.indexOf(",");
  if (comma < 0 || comma >= end) {
    return 0;
  }
  let payload = data.slice(comma + 1, end);
  if (/;base64$/i.test(data.slice(0, comma))) {
    if (/[%\t\n\f\r ]/.test(payload)) {
      payload = payload
        .replace(/%([\da-f]{2})/gi, (_match, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        )
        .replace(/[\t\n\f\r ]/g, "");
    }
    return getBase64PayloadSize(payload);
  }

  // Each percent escape is one byte, including octets that are not valid UTF-8.
  return new TextEncoder().encode(payload.replace(/%[\da-f]{2}/gi, "_"))
    .byteLength;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type FileRootProps = React.ComponentProps<"div"> & {
  variant?: FileVariant | null | undefined;
  size?: FileSize | null | undefined;
};

function FileRoot({
  className,
  variant,
  size,
  children,
  ...props
}: FileRootProps) {
  return (
    <div
      data-slot="file-root"
      data-variant={variant}
      data-size={size}
      className={[fileRootClass(variant, size), className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

type FileIconDisplayProps = React.ComponentProps<"span"> & {
  mimeType?: string;
};

function FileIconDisplay({
  mimeType,
  className,
  children,
  ...props
}: FileIconDisplayProps) {
  const IconComponent = mimeType ? getMimeTypeIcon(mimeType) : FileIcon;

  return (
    <span
      data-slot="file-icon"
      className={[sx(paint.s6), className].filter(Boolean).join(" ")}
      {...props}
    >
      {/* eslint-disable-next-line react-hooks/static-components -- The helper only selects module-level icon components. */}
      {children ?? <IconComponent className={sx(paint.s7)} />}
    </span>
  );
}

function FileName({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="file-name"
      className={[sx(paint.s8), className].filter(Boolean).join(" ")}
      {...props}
    >
      {children || "Unnamed file"}
    </span>
  );
}

type FileSizeProps = React.ComponentProps<"span"> & {
  bytes: number;
};

function FileSize({ bytes, className, ...props }: FileSizeProps) {
  return (
    <span
      data-slot="file-size"
      className={[sx(paint.s9), className].filter(Boolean).join(" ")}
      {...props}
    >
      {formatFileSize(bytes)}
    </span>
  );
}

type FileDownloadProps = Omit<React.ComponentProps<"a">, "href"> & {
  data: string;
  mimeType: string;
  filename?: string;
  sourceType?: "url" | "id";
};

function FileDownload({
  data,
  mimeType,
  filename,
  sourceType,
  className,
  children,
  ...props
}: FileDownloadProps) {
  if (typeof data !== "string") return null;
  const kind = getFileDataKind(data, sourceType);
  const href = getFileHref(data, mimeType, sourceType);
  if (!href) return null;

  return (
    <a
      data-slot="file-download"
      href={href}
      download={filename || "download"}
      {...(kind === "url" && { target: "_blank", rel: "noopener noreferrer" })}
      className={[sx(paint.s10), className].filter(Boolean).join(" ")}
      aria-label={!children ? `Download ${filename || "file"}` : undefined}
      {...props}
    >
      {children || <DownloadIcon className={sx(paint.s11)} />}
    </a>
  );
}

export interface FilePlayerProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  data: string;
  mimeType: string;
  filename?: string | undefined;
  sourceType?: "url" | "id" | undefined;
}

function FilePlayer({
  data,
  mimeType,
  filename,
  sourceType,
  className,
  ...props
}: FilePlayerProps) {
  const src = getFileHref(data, mimeType, sourceType);
  const normalizedMimeType = mimeType.toLowerCase();

  if (
    !src ||
    (!normalizedMimeType.startsWith("audio/") &&
      !normalizedMimeType.startsWith("video/"))
  ) {
    return null;
  }

  return (
    <div data-slot="file-player" className={[sx(paint.s12), className].filter(Boolean).join(" ")} {...props}>
      {normalizedMimeType.startsWith("audio/") ? (
        <AudioPlayer src={src} title={filename} />
      ) : (
        <VideoPlayer src={src} title={filename} />
      )}
    </div>
  );
}

const FileImpl: FileMessagePartComponent = ({
  filename,
  data,
  mimeType,
  sourceType,
}) => {
  const kind = getFileDataKind(data, sourceType);
  const showSize =
    typeof data === "string" && (kind === "base64" || kind === "data-uri");
  const mediaSource = getFileHref(data, mimeType, sourceType);
  const isMedia =
    mimeType.toLowerCase().startsWith("audio/") ||
    mimeType.toLowerCase().startsWith("video/");

  if (mediaSource && isMedia) {
    return (
      <div className={sx(paint.s13)}>
        <FilePlayer
          data={data}
          mimeType={mimeType}
          {...(filename !== undefined && { filename })}
          {...(sourceType !== undefined && { sourceType })}
        />
        <div className={sx(paint.s14)}>
          {showSize && (
            <FileSize
              bytes={
                kind === "data-uri" ? getDataUrlSize(data) : getBase64Size(data)
              }
              className={sx(paint.s15)}
            />
          )}
          <FileDownload
            data={data}
            mimeType={mimeType}
            {...(filename !== undefined && { filename })}
            {...(sourceType !== undefined && { sourceType })}
          />
        </div>
      </div>
    );
  }

  return (
    <FileRoot>
      <FileIconDisplay mimeType={mimeType} />
      <div className={sx(paint.s16)}>
        <FileName>{filename}</FileName>
        {showSize && (
          <FileSize
            bytes={
              kind === "data-uri" ? getDataUrlSize(data) : getBase64Size(data)
            }
            className={sx(paint.s17)}
          />
        )}
      </div>
      <FileDownload
        data={data}
        mimeType={mimeType}
        {...(filename !== undefined && { filename })}
        {...(sourceType !== undefined && { sourceType })}
      />
    </FileRoot>
  );
};

const File = memo(FileImpl) as unknown as FileMessagePartComponent & {
  Root: typeof FileRoot;
  Icon: typeof FileIconDisplay;
  Name: typeof FileName;
  Size: typeof FileSize;
  Download: typeof FileDownload;
  Player: typeof FilePlayer;
};

File.displayName = "File";
File.Root = FileRoot;
File.Icon = FileIconDisplay;
File.Name = FileName;
File.Size = FileSize;
File.Download = FileDownload;
File.Player = FilePlayer;

export {
  File,
  FileRoot,
  FileIconDisplay,
  FileName,
  FileSize,
  FileDownload,
  FilePlayer,
  getMimeTypeIcon,
  getFileDataKind,
  getBase64Size,
  formatFileSize,
};
