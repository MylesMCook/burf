import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { laptopApi, type NetworkInfo } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Code } from "@/views/settings/rows";

// LinkStep pairs with a box that already runs berthd: `berthd pair` there
// prints a single-use link to paste here.
export function LinkStep({ onDone }: { onDone(box: string): void }) {
  const client = useStore((s) => s.client);
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [network, setNetwork] = useState("");
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (client) laptopApi.networks(client).then(setNetworks, () => {});
  }, [client]);


  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!client) return;
        if (!link.trim().startsWith("berth://")) {
          setError("That isn't a pairing link. It starts with berth:// and comes from berthd pair on the box.");
          return;
        }
        setBusy(true);
        setError(undefined);
        try {
          const peer = await laptopApi.pair(client, link.trim(), name.trim(), network);
          await useStore.getState().refreshAll();
          onDone(peer.name);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-muted-foreground text-sm">
        On a box that already runs berthd, run <Code>berthd pair</Code> and paste the link it prints. Links work once, for ten minutes.
      </p>
      <Textarea value={link} onChange={(e) => setLink(e.target.value)} placeholder="berth://100.64.0.1:7444?code=…&fp=…" className="font-mono text-xs" rows={3} autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-muted-foreground text-xs">Name in Berth (optional)</span>
          <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="The box's hostname" />
        </label>
        {networks.length > 0 && (
          <label className="space-y-1.5">
            <span className="text-muted-foreground text-xs">Reach it through</span>
            <SimpleSelect
              size="sm"
              value={network}
              onChange={setNetwork}
              options={[{ value: "", label: "This computer's network" }, ...networks.map((n) => ({ value: n.name, label: `${n.name} tailnet` }))]}
            />
          </label>
        )}
      </div>
      {error && <p className="text-destructive-foreground text-sm">{error}</p>}
      <div className="flex">
        <Button size="sm" type="submit" loading={busy}>
          Pair
        </Button>
      </div>
    </form>
  );
}
