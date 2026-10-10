"use client";

import * as stylex from "@stylexjs/stylex";
import {
  type PropsWithChildren,
  useState,
  type FC,
  isValidElement,
} from "react";
import {
  XIcon,
  PlusIcon,
  FileText,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
  useAui,
} from "@assistant-ui/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { useAttachmentSrc } from "@/hooks/use-attachment-src";

const paint = stylex.create({
  s0: {
    "display": "block",
    "height": "auto",
    "maxHeight": "80vh",
    "width": "auto",
    "maxWidth": "100%",
    "borderRadius": "var(--radius-sm)",
    "objectFit": "contain",
    "transitionProperty": "opacity",
    "transitionDuration": "300ms",
  },
  s1: {
    "opacity": 1,
  },
  s2: {
    "opacity": 0,
  },
  s3: {
    "cursor": "zoom-in",
  },
  s4: {
    "backgroundColor": "var(--background)",
    "position": "relative",
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "maxHeight": "80dvh",
    "width": "100%",
    "alignItems": "center",
    "justifyContent": "center",
    "overflow": "hidden",
    "borderRadius": "var(--radius-sm)",
  },
  s5: {
    "color": "color-mix(in oklab, var(--muted-foreground) 80%, transparent)",
    "width": "24px",
    "height": "24px",
    "stroke": "1.5",
  },
  s6: {
    "position": "relative",
  },
  s7: {
    "transitionDuration": "200ms",
  },
  s8: {
    "backgroundColor": {
      "default": "var(--muted)",
      ":hover::after": "color-mix(in oklab, var(--foreground) 10%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 1px var(--ring)",
      "::after": "light-dark(0 0 0 2px color-mix(in oklab, #000 10%, transparent), 0 0 0 2px color-mix(in oklab, #fff 10%, transparent))",
    },
    "position": {
      "default": "relative",
      "::after": "absolute",
    },
    "width": "56px",
    "height": "56px",
    "overflow": "hidden",
    "borderRadius": {
      "default": "calc(var(--composer-radius,1rem)-var(--composer-padding,8px))",
      "::after": "inherit",
    },
    "transitionProperty": {
      "default": "transform",
      "::after": "color, background-color, border-color",
    },
    "transitionDuration": {
      "default": "150ms",
      "::after": "150ms",
    },
    "outline": "none",
    "pointerEvents": {
      "::after": "none",
    },
    "top": {
      "::after": 0,
    },
    "right": {
      "::after": 0,
    },
    "bottom": {
      "::after": 0,
    },
    "left": {
      "::after": 0,
    },
  },
  s9: {
    "cursor": "zoom-in",
    "transform": {
      ":active": "scale(NaN)",
    },
  },
  s10: {
    "cursor": "default",
  },
  s11: {
    "boxShadow": {
      "::after": "0 0 0 2px color-mix(in oklab, var(--destructive) 60%, transparent)",
    },
  },
  s12: {
    "backgroundColor": "color-mix(in oklab, var(--background) 60%, transparent)",
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s13: {
    "color": "var(--muted-foreground)",
    "width": "16px",
    "height": "16px",
  },
  s14: {
    "backgroundColor": "color-mix(in oklab, var(--background) 70%, transparent)",
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s15: {
    "color": "var(--destructive)",
    "width": "16px",
    "height": "16px",
  },
  s16: {
    "width": "12px",
    "height": "12px",
    "stroke": "2.5",
  },
  s17: {
    "gridColumn": "1 / -1",
    "gridColumnStart": "1",
    "gridRowStart": "1",
    "display": {
      "default": "flex",
      ":empty": "none",
    },
    "width": "100%",
    "flexDirection": "row",
    "justifyContent": "flex-end",
    "gap": "8px",
  },
  s18: {
    "display": {
      "default": "flex",
      ":empty": "none",
    },
    "width": "100%",
    "flexDirection": "row",
    "alignItems": "center",
    "gap": "8px",
    "overflowX": "auto",
  },
  s19: {
    "width": "16px",
    "height": "16px",
  },
  q20: {
    "backdropFilter": "blur(2px)",
  },
  q21: {
    "backdropFilter": "blur(2px)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type AttachmentPreviewProps = {
  src: string;
  name: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src, name }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={`Preview of ${name}`}
      className={[sx(paint.s0), isLoaded ? [sx(paint.s1), "aui-attachment-preview-image-loaded"].filter(Boolean).join(" ") : [sx(paint.s2), "aui-attachment-preview-image-loading"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
      onLoad={() => setIsLoaded(true)}
    />
  );
};

type AttachmentPreviewDialogProps = PropsWithChildren<{
  src: string | undefined;
  name: string;
}>;

const AttachmentPreviewDialog: FC<AttachmentPreviewDialogProps> = ({
  children,
  src,
  name,
}) => {
  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger
        className={[sx(paint.s3), "aui-attachment-preview-trigger"].filter(Boolean).join(" ")}
        render={
          isValidElement(children) ? (
            children
          ) : (
            <button type="button">{children}</button>
          )
        }
      />
      <DialogContent closeTone="media" frame="preview" marker="aui-attachment-preview-dialog-content" width="3xl">
        <DialogTitle hidden marker="aui-sr-only">
          Preview {name}
        </DialogTitle>
        <div className={[sx(paint.s4), "aui-attachment-preview"].filter(Boolean).join(" ")}>
          <AttachmentPreview src={src} name={name} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC<{ src: string | undefined }> = ({ src }) => {
  return (
    <Avatar fill marker="aui-attachment-tile-avatar">
      <AvatarImage
        src={src}
        alt=""
        marker="aui-attachment-tile-image"
      />
      <AvatarFallback>
        <FileText className={[sx(paint.s5), "aui-attachment-tile-fallback-icon"].filter(Boolean).join(" ")} />
      </AvatarFallback>
    </Avatar>
  );
};

const AttachmentUI: FC = () => {
  const aui = useAui();
  const isComposer = aui.attachment.source !== "message";
  const src = useAttachmentSrc();

  const isImage = useAuiState((s) => s.attachment.type === "image");
  const name = useAuiState((s) => s.attachment.name);
  const typeLabel = useAuiState((s) => {
    const type = s.attachment.type;
    switch (type) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        return type;
    }
  });

  // An attachment on a submission is still being prepared, whether or not the
  // adapter reports progress while it uploads.
  const uploadState = useAuiState((s) =>
    s.attachment.status.type === "incomplete" &&
    s.attachment.status.reason === "error"
      ? "error"
      : s.attachment.status.type === "running" ||
          (s.optional.message?.submission !== undefined &&
            s.attachment.status.type !== "complete")
        ? "uploading"
        : undefined,
  );
  const isUploading = uploadState === "uploading";
  const isError = uploadState === "error";

  const errorMessage = useAuiState((s) =>
    s.attachment.status.type === "incomplete" &&
    s.attachment.status.reason === "error"
      ? (s.attachment.status.message ?? "Upload failed")
      : undefined,
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <AttachmentPrimitive.Root
          className={[[sx(paint.s6), "aui-attachment-root"].filter(Boolean).join(" "), isComposer && [sx(paint.s7), "burf-fade"].filter(Boolean).join(" "), isImage &&
              !isComposer && "aui-attachment-root-message only:*:first:size-24"].filter(Boolean).join(" ")}
        >
          <AttachmentPreviewDialog src={src} name={name}>
            <TooltipTrigger
              render={
                <div
                className={[[sx(paint.s8), "aui-attachment-tile"].filter(Boolean).join(" "), src ? sx(paint.s9) : sx(paint.s10), isError && sx(paint.s11)].filter(Boolean).join(" ")}
                role={src ? "button" : "group"}
                tabIndex={0}
                onKeyDown={
                  src
                    ? (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.click();
                        } else if (e.key === " ") {
                          e.preventDefault();
                        }
                      }
                    : undefined
                }
                onKeyUp={
                  src
                    ? (e) => {
                        if (e.key === " ") e.currentTarget.click();
                      }
                    : undefined
                }
                aria-label={`${src ? `Preview ${name}` : `${typeLabel} attachment ${name}`}${
                  isError ? ", upload failed" : isUploading ? ", uploading" : ""
                }`}
                />
              }
            >
                <AttachmentThumb src={src} />
                {isUploading && (
                  <div
                    aria-hidden="true"
                    className={[sx(paint.s12), [sx(paint.q20), "aui-attachment-tile-uploading burf-fade"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
                  >
                    <Loader2Icon className={[sx(paint.s13), "burf-spin"].filter(Boolean).join(" ")} />
                  </div>
                )}
                {isError && (
                  <div
                    aria-hidden="true"
                    className={[sx(paint.s14), [sx(paint.q21), "aui-attachment-tile-error burf-fade"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
                  >
                    <AlertCircleIcon className={sx(paint.s15)} />
                  </div>
                )}
            </TooltipTrigger>
          </AttachmentPreviewDialog>
          {isComposer && <AttachmentRemove name={name} />}
        </AttachmentPrimitive.Root>
        <TooltipContent side="top">
          <AttachmentPrimitive.Name />
          {errorMessage && (
            <p className="aui-attachment-error-message">{errorMessage}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const AttachmentRemove: FC<{ name: string }> = ({ name }) => {
  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip={`Remove ${name}`}
        marker="aui-attachment-tile-remove"
        place="remove"
        box={5}
        round
        side="top"
      >
        <XIcon className={[sx(paint.s16), "aui-attachment-remove-icon"].filter(Boolean).join(" ")} />
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className={[sx(paint.s17), "aui-user-message-attachments-end"].filter(Boolean).join(" ")}>
      <MessagePrimitive.Attachments>
        {() => <AttachmentUI />}
      </MessagePrimitive.Attachments>
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className={[sx(paint.s18), "aui-composer-attachments"].filter(Boolean).join(" ")}>
      <ComposerPrimitive.Attachments>
        {() => <AttachmentUI />}
      </ComposerPrimitive.Attachments>
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
  return (
    <ComposerPrimitive.AddAttachment asChild>
      <TooltipIconButton
        tooltip="Add Attachment"
        side="bottom"
        variant="ghost"
        size="icon"
        marker="aui-composer-add-attachment"
        box={7}
        round
        tone="muted"
        wash
        aria-label="Add Attachment"
      >
        <PlusIcon className={[sx(paint.s19), "aui-attachment-add-icon"].filter(Boolean).join(" ")} />
      </TooltipIconButton>
    </ComposerPrimitive.AddAttachment>
  );
};
