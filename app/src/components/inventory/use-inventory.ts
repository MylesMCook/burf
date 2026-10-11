import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";

import type { Client } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { appendChanges, type Change, coalesceBy, HISTORY_PAGE, inventoryApi, inventoryMissing, type Machine, type MachineLookup, olderSnapshot, type Snapshot } from "@/lib/inventory";
import { poll } from "@/lib/poll";
import { useStore } from "@/lib/store";

// The machines the laptop agent knows (lib/inventory.ts), for the sidebar,
// Settings and a machine's own page.
//
// Every answer here belongs to the client and machine it was asked of. One
// that comes back after either has changed, or after a newer answer, is
// dropped: a late read must not undo a scan, and one agent's machine must
// not show under another's.

interface MachinesState {
  // missing: the agent is older than machine inventory. Everything else in
  // the app carries on without it.
  state: "loading" | "ready" | "missing" | "failed";
  machines: Machine[];
  error?: string;
}

const NO_MACHINES: MachinesState = { state: "loading", machines: [] };

// The list, and the client it was read from. An id from one agent means
// nothing to another, so the list is only ever one client's.
const registry = create<MachinesState & { client?: Client }>(() => NO_MACHINES);

// useMachines reads the list as the current client's. Another client's
// reads as not loaded yet, so nothing shows or acts on its machines.
export function useMachines<T>(select: (s: MachinesState) => T): T {
  const client = useStore((s) => s.client);
  return registry((s) => select(s.client === client ? s : NO_MACHINES));
}

// One read per client at a time. A new client's read starts at once, not
// behind the one before it, whose answer is dropped.
const readMachines = coalesceBy(async (client: Client) => {
  const mine = () => registry.getState().client === client;
  try {
    const machines = await inventoryApi.machines(client);
    if (mine()) registry.setState({ state: "ready", machines, error: undefined });
  } catch (err) {
    // A read that fails keeps this client's last list.
    if (mine()) registry.setState({ state: inventoryMissing(err) ? "missing" : "failed", error: errorMessage(err) });
  }
});

// loadMachines reads the list again. The list is emptied first when it was
// another client's, so that client's machines are gone whatever this read
// answers.
export function loadMachines(): Promise<void> {
  const client = useStore.getState().client;
  if (!client) return Promise.resolve();
  if (registry.getState().client !== client) registry.setState({ ...NO_MACHINES, client, error: undefined });
  return readMachines(client);
}

// useLoadMachines keeps the list current: on connect, and when the paired
// computers change.
export function useLoadMachines() {
  const client = useStore((s) => s.client);
  const boxes = useStore((s) => (s.status?.boxes ?? []).map((b) => b.name).join("\n"));
  useEffect(() => {
    if (client) void loadMachines();
  }, [client, boxes]);
}

const lookupKey = (where: MachineLookup) => ("id" in where ? `id:${where.id}` : "local" in where ? "local" : `box:${where.box}`);

// useMachine is the agent's record for this computer or a paired box. It is
// undefined until the agent answers, and stays so on an agent without
// machine inventory: the view asking shows nothing new.
//
// Which record that is can change: attaching a pairing to another machine
// moves it there and may remove the machine that held it. So it is asked
// again whenever the list of machines changes, and an answer of "none"
// clears what was held.
export function useMachine(where: MachineLookup): Machine | undefined {
  const client = useStore((s) => s.client);
  const listed = useMachines((s) => s.machines);
  const key = lookupKey(where);
  const [found, setFound] = useState<{ client: Client; key: string; machine?: Machine }>();
  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    inventoryApi.find(client, where, controller.signal).then(
      (machine) => {
        if (!controller.signal.aborted) setFound({ client, key, machine });
      },
      // A lookup that failed says nothing about the machine: keep what this
      // client and lookup last found.
      () => {},
    );
    return () => controller.abort();
    // key stands for where.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key, listed]);
  return found && found.client === client && found.key === key ? found.machine : undefined;
}

// One client's view of one machine. alive goes false when either changes.
interface InventoryScope {
  client: Client;
  id: string;
  alive: boolean;
  // The newest snapshot applied: what a late answer is measured against.
  snapshot?: Snapshot;
  reading?: AbortController;
  scanning: boolean;
}

interface InventoryView {
  client?: Client;
  id?: string;
  snapshot?: Snapshot;
  error?: string;
  scanning?: boolean;
  scanError?: string;
}

const NO_INVENTORY: InventoryView = {};

// useInventory reads one machine's services and keeps them fresh while
// shown. Reading asks the agent for what it holds; only scan() makes it look
// at the machine now. Either failing keeps what was last read for this
// client and machine; a change of either starts from nothing.
export function useInventory(id: string) {
  const client = useStore((s) => s.client);
  const [view, setView] = useState<InventoryView>(NO_INVENTORY);
  const scope = useRef<InventoryScope | undefined>(undefined);

  // show changes what a scope shows. A scope that has ended shows nothing more.
  const show = useCallback((s: InventoryScope, change: (v: InventoryView) => InventoryView) => {
    if (!s.alive) return;
    setView((v) => change(v.client === s.client && v.id === s.id ? v : { client: s.client, id: s.id }));
  }, []);

  // take applies a snapshot unless a later observation is already held.
  const take = useCallback(
    (s: InventoryScope, next: Snapshot) => {
      if (!s.alive || olderSnapshot(next, s.snapshot)) return false;
      s.snapshot = next;
      show(s, (v) => ({ ...v, snapshot: next, error: undefined }));
      return true;
    },
    [show],
  );

  // readIn answers whether it found anything new, for the poll's pace.
  const readIn = useCallback(
    async (s: InventoryScope) => {
      if (!s.alive) return false;
      // Only the latest read counts.
      s.reading?.abort();
      const controller = new AbortController();
      s.reading = controller;
      const before = s.snapshot?.at;
      try {
        const next = await inventoryApi.inventory(s.client, s.id, controller.signal);
        if (controller.signal.aborted) return false;
        if (take(s, next)) return next.at !== before;
        // The agent answered, with something older than a scan already gave.
        show(s, (v) => ({ ...v, error: undefined }));
        return false;
      } catch (err) {
        if (!controller.signal.aborted) show(s, (v) => ({ ...v, error: errorMessage(err) }));
        return false;
      }
    },
    [show, take],
  );

  useEffect(() => {
    if (!client) return;
    const s: InventoryScope = { client, id, alive: true, scanning: false };
    scope.current = s;
    const poller = poll(() => readIn(s), { every: 15_000, max: 60_000 });
    return () => {
      s.alive = false;
      s.reading?.abort();
      poller.stop();
      if (scope.current === s) scope.current = undefined;
    };
  }, [client, id, readIn]);

  const read = useCallback(async () => {
    if (scope.current) await readIn(scope.current);
  }, [readIn]);

  const scan = useCallback(async () => {
    const s = scope.current;
    // One scan of a machine at a time.
    if (!s?.alive || s.scanning) return;
    s.scanning = true;
    show(s, (v) => ({ ...v, scanning: true, scanError: undefined }));
    try {
      take(s, await inventoryApi.refresh(s.client, s.id));
    } catch (err) {
      show(s, (v) => ({ ...v, scanError: errorMessage(err) }));
      // The agent may have recorded the failed attempt.
      await readIn(s);
    } finally {
      s.scanning = false;
      show(s, (v) => ({ ...v, scanning: false }));
    }
  }, [readIn, show, take]);

  const mine = view.client === client && view.id === id ? view : NO_INVENTORY;
  return { snapshot: mine.snapshot, error: mine.error, scanning: !!mine.scanning, scanError: mine.scanError, read, scan };
}

// One client's view of one service's history.
interface HistoryScope {
  client: Client;
  machine: string;
  service: string;
  alive: boolean;
  changes?: Change[];
  // Later pages are still unread.
  more: boolean;
  loading: boolean;
  // A newer observation came in while a page was being read.
  again: boolean;
  request?: AbortController;
}

interface HistoryView {
  client?: Client;
  machine?: string;
  service?: string;
  changes?: Change[];
  more?: boolean;
  error?: string;
  loading?: boolean;
}

const NO_HISTORY: HistoryView = {};

// useServiceHistory is one service's changes, oldest first, a page at a
// time. One page is read at a time, a page answered twice adds nothing
// twice, and an answer for another service or client is dropped.
//
// seen says when the service was last observed (any value that changes with
// a newer observation). A scan may have recorded a change, so a new value
// reads on from the last change held: what is loaded stays, and the new
// change is added to it.
export function useServiceHistory(machine: string, service: string, seen: string) {
  const client = useStore((s) => s.client);
  const [view, setView] = useState<HistoryView>(NO_HISTORY);
  const scope = useRef<HistoryScope | undefined>(undefined);

  const show = useCallback((s: HistoryScope, change: (v: HistoryView) => HistoryView) => {
    if (!s.alive) return;
    setView((v) => change(v.client === s.client && v.machine === s.machine && v.service === s.service ? v : { client: s.client, machine: s.machine, service: s.service }));
  }, []);

  // loadIn reads the next page: the first, or the one after the last change
  // held. fresh is a read for a newer observation, not one a person asked for.
  const loadIn = useCallback(
    async (s: HistoryScope, fresh = false) => {
      if (!s.alive) return;
      if (s.loading) {
        // The page being read may have been answered before the change was recorded.
        if (fresh) s.again = true;
        return;
      }
      // With later pages unread, the new change is on one of them.
      if (fresh && s.more) return;
      s.loading = true;
      const controller = new AbortController();
      s.request = controller;
      show(s, (v) => ({ ...v, loading: true, error: undefined }));
      try {
        do {
          s.again = false;
          const held = s.changes ?? [];
          const page = await inventoryApi.history(s.client, s.machine, s.service, held.length ? held[held.length - 1].id : undefined, controller.signal);
          if (controller.signal.aborted) return;
          const changes = appendChanges(held, page);
          const more = page.length >= HISTORY_PAGE;
          s.changes = changes;
          s.more = more;
          show(s, (v) => ({ ...v, changes, more }));
        } while (s.again && !s.more);
      } catch (err) {
        // What is already loaded stays.
        if (!controller.signal.aborted) show(s, (v) => ({ ...v, error: errorMessage(err) }));
      } finally {
        s.loading = false;
        s.again = false;
        show(s, (v) => ({ ...v, loading: false }));
      }
    },
    [show],
  );

  useEffect(() => {
    if (!client) return;
    const s: HistoryScope = { client, machine, service, alive: true, more: false, loading: false, again: false };
    scope.current = s;
    void loadIn(s);
    return () => {
      s.alive = false;
      s.request?.abort();
      if (scope.current === s) scope.current = undefined;
    };
  }, [client, machine, service, loadIn]);

  // After the first read, which the effect above makes.
  const read = useRef(seen);
  useEffect(() => {
    if (read.current === seen) return;
    read.current = seen;
    if (scope.current) void loadIn(scope.current, true);
  }, [seen, loadIn]);

  const loadMore = useCallback(async () => {
    if (scope.current) await loadIn(scope.current);
  }, [loadIn]);

  const mine = view.client === client && view.machine === machine && view.service === service ? view : NO_HISTORY;
  return { changes: mine.changes, more: !!mine.more, error: mine.error, loading: !!mine.loading, loadMore };
}
