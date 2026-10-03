import { useEffect } from "react";

import { mockAgentDown, waitForRetry } from "@/lib/agent-start";
import { endpoint, httpClient, type Client } from "@/lib/api";
import { handleEvent } from "@/lib/events";
import { errorMessage } from "@/lib/format";
import { mockClient } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { loadNav } from "@/lib/nav";
import { loadNotifications } from "@/lib/notifications";
import { loadProjects } from "@/lib/project-groups";
import { reloadKits } from "@/views/kits/kits-store";
import { loadPlugins } from "@/plugins/host";

export const isMock = () => new URLSearchParams(location.search).has("mock");

// useBerthConnection finds the agent, keeps trying until it answers, then
// follows its events and polls slowly as a backstop. Every reconnect of the
// event stream refetches everything, so nothing missed while away (sleep, a
// network change, the agent restarting) stays stale.
export function useBerthConnection() {
  useEffect(() => {
    const abort = new AbortController();
    const { setClient, setConnection, refreshAll } = useStore.getState();
    let poll = 0;

    const connect = async (): Promise<Client | undefined> => {
      let delay = 1000;
      while (!abort.signal.aborted) {
        try {
          // ?mock=offline is the "not running" screen until its agent starts.
          if (mockAgentDown()) throw new Error("the Berth agent has not started yet (mock)");
          if (isMock()) return mockClient();
          const client = httpClient(await endpoint());
          await client.status();
          return client;
        } catch (err) {
          setConnection({ state: "offline", error: errorMessage(err) });
        }
        // Starting the agent from the "not running" screen asks for a try now.
        if ((await waitForRetry(delay)) === "retry") delay = 1000;
        else delay = Math.min(delay * 2, 10_000);
      }
    };

    void connect().then((client) => {
      if (!client || abort.signal.aborted) return;
      setClient(client);
      void refreshAll();
      void loadPlugins(client);
      void loadProjects();
      void loadNav();
      void loadNotifications();
      // Project menus show each project's kit status.
      void reloadKits();
      client.events(handleEvent, () => void refreshAll(), abort.signal);
      poll = window.setInterval(() => void refreshAll(), 15_000);
    });

    const onWake = () => void useStore.getState().refreshAll();
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      abort.abort();
      window.clearInterval(poll);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, []);
}
