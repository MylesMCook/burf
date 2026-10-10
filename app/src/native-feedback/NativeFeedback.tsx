import { lazy, Suspense } from "react";
import { trustedWindow } from "./connection.mjs";

declare const __WAILS_FEEDBACK__: boolean;

// The marker is emitted by the application's existing trusted asset middleware.
// Importing the Wails runtime alone is not evidence of a trusted native window.
const Overlay = __WAILS_FEEDBACK__ ? lazy(() => import("./FeedbackGate")) : null;

export function NativeFeedback() {
  if (!__WAILS_FEEDBACK__ || !Overlay) return null;
  const trusted = trustedWindow(typeof window === "undefined" ? undefined : window, "__BURF_WAILS__");
  if (!trusted) return null;
  return <Suspense fallback={null}><Overlay /></Suspense>;
}
