import { WebSpeechDictationAdapter, type DictationAdapter } from "@assistant-ui/react";
import { useEffect, useRef, useState } from "react";

export function useVoiceInput(onText: (text: string) => void, enabled: boolean) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const session = useRef<DictationAdapter.Session | undefined>(undefined);
  const unsubscribe = useRef<(() => void) | undefined>(undefined);
  const receive = useRef(onText);
  receive.current = onText;
  useEffect(() => () => { unsubscribe.current?.(); session.current?.cancel(); }, []);
  useEffect(() => {
    if (enabled) return;
    unsubscribe.current?.(); session.current?.cancel(); setRecording(false);
  }, [enabled]);
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
      const status = session.current?.status;
      if (status?.type === "ended") {
        if (status.reason === "error") setError("Voice input failed. Check microphone access, or type your message.");
        unsubscribe.current?.(); setRecording(false);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [recording]);
  const toggle = () => {
    if (recording) {
      void session.current?.stop().catch(() => { setError("Voice input could not stop. Type your message."); session.current?.cancel(); setRecording(false); });
      return;
    }
    setError("");
    try {
      unsubscribe.current?.();
      const current = new WebSpeechDictationAdapter({ continuous: false, interimResults: false }).listen();
      session.current = current;
      unsubscribe.current = current.onSpeech((result) => { if (result.isFinal) receive.current(result.transcript); });
      setSeconds(0); setRecording(true);
    } catch { setError("Voice input could not start. You can still type your message."); setRecording(false); }
  };
  return { available: typeof (window.SpeechRecognition ?? window.webkitSpeechRecognition) === "function", recording, seconds, error, toggle };
}
