import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { SettingsGroup, SettingsRow, Value } from "@/views/settings/rows";
import { nativeFeedbackWindow, refreshNativeFeedback, setNativeFeedback, useNativeFeedback } from "./state";

export function FeedbackSettings() {
  const { status, pending, checked, retryStatus } = useNativeFeedback();
  const native = nativeFeedbackWindow();
  useEffect(() => { if (native) void refreshNativeFeedback(); }, [native]);
  const development = status.enabled && status.mode === "development";
  return <SettingsGroup title="Feedback">
    <SettingsRow label="Native feedback" description={development ? "Feedback is already on in this development run. Closing its window stops that run." : "Annotate this Burf window for your connected Codex feedback task. Notes stay on this computer. Feedback starts off each time Burf opens; browser panes remain isolated."}>
      {development ? <Value>Development run</Value> : <Button size="sm" aria-label={status.enabled ? "Disable feedback" : "Enable feedback"} variant={status.enabled ? "outline" : "default"} disabled={!native || !status.available || pending || !checked || retryStatus} loading={pending && !retryStatus} onClick={() => void setNativeFeedback(!status.enabled)}>{status.enabled ? "Disable feedback" : "Enable feedback"}</Button>}
    </SettingsRow>
    {!native && <Alert role="note"><AlertDescription>Open Burf's desktop app to enable native feedback.</AlertDescription></Alert>}
    {native && checked && !status.available && !status.error && <Alert role="note"><AlertDescription>Native feedback is unavailable in this desktop shell.</AlertDescription></Alert>}
    {status.error && <Alert variant="error"><AlertDescription>{status.error}</AlertDescription>
      {native && retryStatus && <AlertAction><Button size="sm" aria-label="Retry status" variant="outline" disabled={pending} loading={pending} onClick={() => void refreshNativeFeedback()}>Retry status</Button></AlertAction>}
    </Alert>}
  </SettingsGroup>;
}
