import { create } from "zustand";
import { invoke } from "@/lib/desktop";
import { endpointFrom, trustedWindow } from "./connection.mjs";

export type FeedbackStatus =
  | { available: false; enabled: false; error?: string }
  | { available: true; enabled: false; error?: string }
  | { available: true; enabled: true; endpoint: string; mode: "runtime" | "development"; error?: string };

export function feedbackStatus(value: unknown): FeedbackStatus {
  if (!value || typeof value !== "object" || !("available" in value) || typeof value.available !== "boolean" || !("enabled" in value) || typeof value.enabled !== "boolean") throw new Error("Invalid native feedback status.");
  const error = "error" in value && typeof value.error === "string" ? value.error : undefined;
  if (!value.available) return { available: false, enabled: false, error };
  if (!value.enabled) return { available: true, enabled: false, error };
  return { available: true, enabled: true, endpoint: endpointFrom(value), mode: "mode" in value && value.mode === "development" ? "development" : "runtime", error };
}

export const nativeFeedbackWindow = () => trustedWindow(typeof window === "undefined" ? undefined : window, "__BURF_WAILS__");
export const useNativeFeedback = create<{ status: FeedbackStatus; pending: boolean; checked: boolean; retryStatus: boolean }>()(() => ({ status: { available: false, enabled: false }, pending: false, checked: false, retryStatus: false }));
let operation = 0;

function failedStatus(error: unknown): { status: FeedbackStatus; retryStatus: boolean } {
  const message = error instanceof Error ? error.message : "Could not check native feedback status.";
  if (error instanceof ReferenceError || /^unknown desktop command(?:\s|$)/i.test(message)) {
    return { status: { available: false, enabled: false, error: "Update the Burf desktop shell to use native feedback." }, retryStatus: false };
  }
  return { status: { ...useNativeFeedback.getState().status, error: `Could not check native feedback status. ${message}` }, retryStatus: true };
}

export async function refreshNativeFeedback() {
  if (!nativeFeedbackWindow() || useNativeFeedback.getState().pending) return;
  const current = ++operation;
  useNativeFeedback.setState({ pending: true });
  try {
    const status = feedbackStatus(await invoke("native_feedback_status"));
    if (current === operation) useNativeFeedback.setState({ status, checked: true, retryStatus: false });
  } catch (error) {
    if (current === operation) useNativeFeedback.setState({ ...failedStatus(error), checked: true });
  } finally { if (current === operation) useNativeFeedback.setState({ pending: false }); }
}

export async function setNativeFeedback(enabled: boolean) {
  if (!nativeFeedbackWindow() || useNativeFeedback.getState().pending || useNativeFeedback.getState().retryStatus) return;
  const current = ++operation;
  useNativeFeedback.setState({ pending: true });
  try {
    const status = feedbackStatus(await invoke(enabled ? "native_feedback_enable" : "native_feedback_disable"));
    if (current === operation) useNativeFeedback.setState({ status, checked: true, retryStatus: false });
  } catch (error) {
    let status: FeedbackStatus;
    let retryStatus = false;
    try { status = feedbackStatus(await invoke("native_feedback_status")); }
    catch (statusError) { ({ status, retryStatus } = failedStatus(statusError)); }
    const message = error instanceof Error ? error.message : "Could not change feedback.";
    if (current === operation) useNativeFeedback.setState({ status: { ...status, error: retryStatus ? `${message} Current feedback status could not be checked. Retry status before changing feedback again.` : message }, checked: true, retryStatus });
  } finally { if (current === operation) useNativeFeedback.setState({ pending: false }); }
}
