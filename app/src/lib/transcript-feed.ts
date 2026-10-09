import { useEffect, useState } from "react";

import { boxApi } from "@/lib/api";
import { choicesIn, type Choice, keysOnly, questionFormIn } from "@/lib/screen";
import { useStore } from "@/lib/store";

// useAsk is what an agent waiting for the person asks, from its screen: the
// numbered options, and the line above them as the question; form says it
// shows a form of questions with steps, which no one number answers. A
// menu is drawn a moment after the agent says it waits, so a screen
// without one is read again a few times.
export function useAsk(box: string, session: string, waiting: boolean, since?: string): { detail: string; choices: Choice[]; form?: boolean } | undefined {
  const client = useStore((s) => s.client);
  const [ask, setAsk] = useState<{ detail: string; choices: Choice[]; form?: boolean }>();
  useEffect(() => {
    if (!client || !waiting) {
      setAsk(undefined);
      return;
    }
    let alive = true;
    let tries = 0;
    let timer = 0;
    const read = () =>
      boxApi
      .screen(client, box, session)
      .then((r) => {
        if (!alive) return;
        const screen = r.screen ?? "";
        const choices = choicesIn(screen);
        const form = questionFormIn(screen);
        if (!choices.length && !form && ++tries < 4) timer = window.setTimeout(() => void read(), 600);
        const lines = screen.split("\n").map((l) => l.trim());
        const first = lines.findIndex((l) => /^(?:[❯›>]\s*)?1[.)]\s/.test(l));
        let detail = "";
        // A screen only keys answer (a trust question) asks nothing in
        // words: its own screen opens for it instead (live-screen.tsx).
        for (let i = keysOnly(screen) ? -1 : (first < 0 ? lines.length : first) - 1; i >= 0; i--) {
          const l = lines[i].replace(/^[│|╭╰─\s]+|[│|╮╯─\s]+$/g, "");
          if (l) {
            detail = l;
            break;
          }
        }
        setAsk({ detail, choices, form });
      })
      .catch(() => alive && setAsk({ detail: "", choices: [] }));
    void read();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [client, box, session, waiting, since]);
  return ask;
}
