import { useEffect, useState } from "react";

import { type Away, awayFrom } from "@/lib/net";
import { useStore } from "@/lib/store";

// A box that is away: the laptop agent tries it again on a backoff and says
// when in its status (retry_at). useAway counts down to that try, once a
// second while the box is away, so a pane says "Reconnecting to devl… Next
// try in 6s" rather than only that the box is offline.
export function useAway(box: string): Away {
  const st = useStore((s) => s.status?.boxes.find((b) => b.name === box));
  const [now, setNow] = useState(() => Date.now());
  const away = !!st && st.state !== "online";
  useEffect(() => {
    if (!away) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [away]);
  return awayFrom(st, now);
}

// tryNow asks the agent to try box at once (an older agent tries every
// box), then reads everything again.
export async function tryNow(box: string) {
  const { client, refreshAll } = useStore.getState();
  if (!client) return;
  try {
    await client.laptop("POST", `/v1/refresh?box=${encodeURIComponent(box)}`);
  } catch {
    // The status read below says how it went.
  }
  await refreshAll();
}
