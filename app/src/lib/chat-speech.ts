import { WebSpeechSynthesisAdapter, type SpeechSynthesisAdapter } from "@assistant-ui/react";

// Web Speech owns one browser-wide queue, even when chats use separate adapters.
let active: SpeechSynthesisAdapter.Utterance | undefined;

export function createChatSpeech(onError: () => void): SpeechSynthesisAdapter | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") return;
  const adapter = new WebSpeechSynthesisAdapter();
  return { speak(text) {
    active?.cancel();
    let native: SpeechSynthesisAdapter.Utterance;
    try {
      native = adapter.speak(text);
    } catch (error) {
      onError();
      return { status: { type: "ended", reason: "error", error }, cancel() {}, subscribe: () => () => {} };
    }
    let override: SpeechSynthesisAdapter.Status | undefined;
    let settled = false;
    let unsubscribe = () => {};
    const subscribers = new Set<() => void>();
    const notify = (callback: () => void) => {
      // A consumer must not interrupt ownership release or other subscriptions.
      try { callback(); } catch { /* Keep speech lifecycle independent of consumers. */ }
    };
    const settle = () => {
      if (settled || owned.status.type !== "ended") return;
      settled = true;
      unsubscribe();
      if (active === owned) active = undefined;
      if (owned.status.reason === "error") onError();
      for (const callback of subscribers) notify(callback);
      subscribers.clear();
    };
    const owned: SpeechSynthesisAdapter.Utterance = {
      get status() { return override ?? native.status; },
      cancel() {
        if (settled || active !== owned) return;
        // Clear ownership before native cancel dispatches events synchronously.
        active = undefined;
        try { native.cancel(); }
        catch (error) { override = { type: "ended", reason: "error", error }; }
        settle();
      },
      subscribe(callback) {
        if (settled) {
          let removed = false;
          queueMicrotask(() => { if (!removed) notify(callback); });
          return () => { removed = true; };
        }
        subscribers.add(callback);
        return () => { subscribers.delete(callback); };
      },
    };
    active = owned;
    unsubscribe = native.subscribe(settle);
    // Native speak can dispatch end/error before the adapter returns its handle.
    settle();
    return owned;
  } };
}
