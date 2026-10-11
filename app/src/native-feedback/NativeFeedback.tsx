import { lazy, Suspense, useEffect } from "react";
import { trustedWindow } from "./connection.mjs";
import { refreshNativeFeedback, useNativeFeedback } from "./state";

declare const __WAILS_FEEDBACK__: boolean;

// The marker is emitted by the application's existing trusted asset middleware.
// Importing the Wails runtime alone is not evidence of a trusted native window.
const DevelopmentOverlay = __WAILS_FEEDBACK__ ? lazy(() => import("./FeedbackGate")) : null;
const RuntimeOverlay = lazy(() => import("./FeedbackOverlay"));

export function NativeFeedback() {
  const trusted = trustedWindow(typeof window === "undefined" ? undefined : window, "__BURF_WAILS__");
  const status = useNativeFeedback((state) => state.status);
  useEffect(() => { if (trusted) void refreshNativeFeedback(); }, [trusted]);
  if (!trusted) return null;
  if (status.enabled && status.mode === "runtime") return <Suspense fallback={null}><RuntimeOverlay endpoint={status.endpoint} /></Suspense>;
  if (DevelopmentOverlay) return <Suspense fallback={null}><DevelopmentOverlay /></Suspense>;
  return null;
}
