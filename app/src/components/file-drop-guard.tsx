import * as stylex from "@stylexjs/stylex";
import { PaperclipIcon } from "lucide-react";
import { useEffect, useState } from "react";


const paint = stylex.create({
  s0: {
    "pointerEvents": "none",
    "position": "fixed",
    "bottom": "calc(var(--berth-status-h,26px)+20px)",
    "zIndex": 80,
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "paddingInlineStart": "12px",
    "paddingInlineEnd": "16px",
    "color": "var(--popover-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
    "boxShadow": "0 20px 25px color-mix(in oklab, var(--foreground) 16%, transparent)",
  },
  s1: {
    "visibility": "hidden",
    "opacity": 0,
    "transitionDuration": "150ms",
    "transitionTimingFunction": "cubic-bezier(0, 0, 0.2, 1)",
  },
  s2: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },

  s3: {
    left: "50%",
    translate: "-50%",
  },
  s4: {
    transitionProperty: "opacity, translate, visibility",
    visibility: { "[data-shown]": "visible" },
    opacity: { "[data-shown]": 1 },
    translate: { default: "0px 4px", "[data-shown]": "0px 0px" },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// FileDropGuard keeps a file dropped where nothing takes it from replacing
// the app. The window gets the browser's own drag and drop (tauri.conf's
// dragDropEnabled is false, so the sidebar, tabs and Home widgets can drag),
// and a file let fall on a page that doesn't take it is opened in its place:
// the whole window becomes that markdown file or image, with no way back.
//
// Places that take files (a chat's or a task's composer, a terminal)
// accept the drag first, by preventing its default. What reaches the
// window unaccepted is refused here: no drop, and a hint says where a file
// goes. Only drags that carry files are touched, so the app's own drags
// (a project, a tab, a widget) go on as they were.

const carriesFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");

// dragover comes every 50 ms or so while a drag is over the window; when it
// stops coming, the drag has left or ended.
const QUIET_MS = 200;

export function FileDropGuard() {
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    let quiet = 0;
    const hideSoon = () => {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(() => setRefused(false), QUIET_MS);
    };
    const onOver = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      hideSoon();
      // Taken by what is under it.
      if (e.defaultPrevented) {
        setRefused(false);
        return;
      }
      e.preventDefault();
      e.dataTransfer!.dropEffect = "none";
      setRefused(true);
    };
    const onDrop = (e: DragEvent) => {
      window.clearTimeout(quiet);
      setRefused(false);
      // A drop that nothing handled never opens the file.
      if (carriesFiles(e) && !e.defaultPrevented) e.preventDefault();
    };
    const onEnd = () => {
      window.clearTimeout(quiet);
      setRefused(false);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onEnd);
    return () => {
      window.clearTimeout(quiet);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onEnd);
    };
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="file-drop-hint"
      data-shown={refused || undefined}
      className={[[sx(paint.s0), sx(paint.s3)].filter(Boolean).join(" "), [sx(paint.s1), sx(paint.s4)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
    >
      <PaperclipIcon className={sx(paint.s2)} />
      <span>Drop on a message box or a terminal to attach</span>
    </div>
  );
}
