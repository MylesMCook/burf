import { lazy, Suspense, useEffect, useState } from "react";
import { Call } from "@wailsio/runtime";
import { endpointFrom } from "./connection.mjs";
// Agentation loads only after exact-main-window authorization from Go.
const Overlay = lazy(() => import("./FeedbackOverlay"));

export default function FeedbackGate() {
  const [endpoint, setEndpoint] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const configuration = Call.ByName("github.com/MylesMCook/burf/app/native" + "/internal/nativefeedback.Service.Configuration");
    const timeout = setTimeout(() => { configuration.cancel(); controller.abort(); setFailed(true); }, 15000);
    setFailed(false);
    void (async () => {
      const next = endpointFrom(await configuration);
      const health = await fetch(`${next}/health`, { signal: controller.signal });
      if (!health.ok) throw new Error("Feedback companion is unavailable.");
      if (!controller.signal.aborted) setEndpoint(next);
    })().catch(() => { if (!controller.signal.aborted) setFailed(true); }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); configuration.cancel(); controller.abort(); };
  }, [attempt]);
  if (endpoint) return <Suspense fallback={null}><Overlay endpoint={endpoint} /></Suspense>;
  if (failed) return <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry feedback connection</button>;
  return null;
}
