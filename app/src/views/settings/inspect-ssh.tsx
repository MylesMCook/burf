import * as stylex from "@stylexjs/stylex";
import { CircleAlertIcon, PlusIcon, ServerIcon } from "lucide-react";
import { useState } from "react";

import { loadMachines, useLoadMachines, useMachines } from "@/components/inventory/use-inventory";
import { PickOne, type PickOneOption } from "@/components/pick-one";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectGroup, SelectGroupLabel, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toastManager } from "@/components/ui/toast";
import { errorMessage } from "@/lib/format";
import { inventoryApi, type Machine, type MachineOS, routeLabel, sshOnly, sshTargetError, withRoute } from "@/lib/inventory";
import { NONE, useStore } from "@/lib/store";
import { SettingsGroup, SettingsRow } from "@/views/settings/rows";

const styles = stylex.create({
  pad: { display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 },
  bone: { height: 28 },
  name: { display: "flex", alignItems: "center", gap: 8 },
});

// A new machine, in the form's machine choice.
const NEW = "";

type OsChoice = "" | MachineOS;
const OS_OPTIONS: PickOneOption<OsChoice>[] = [
  { value: "", label: "Not specified" },
  { value: "darwin", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "windows", label: "Windows" },
];

type RouteChoice = "ssh" | "paired";
const ROUTE_OPTIONS: PickOneOption<RouteChoice>[] = [
  { value: "ssh", label: "SSH" },
  { value: "paired", label: "Paired computer" },
];

// MachineInventoryGroup lists the machines Burf keeps an inventory for, in
// Settings › Paired computers, and is where one is added for inspection over
// SSH: reading its services without installing Burf's daemon there. A route
// is attached to the machine the person picks; nothing is merged by name.
// useInspectSsh says whether the form can be offered, in Settings and in Add
// computer alike: not while the agent is still answering, and not on an agent
// older than machine inventory. Asking keeps the list of machines current.
export function useInspectSsh() {
  useLoadMachines();
  const state = useMachines((s) => s.state);
  return { state, ready: state !== "missing" && state !== "loading" };
}

export function MachineInventoryGroup() {
  const { state, ready } = useInspectSsh();
  const machines = useMachines((s) => s.machines);
  const error = useMachines((s) => s.error);
  const [request, setRequest] = useState<{ machine?: Machine }>();
  return (
    <>
      <SettingsGroup
        title="Machine inventory"
        description="Burf lists what runs on each machine. Inspect over SSH reads a machine's services without installing Burf's daemon there, so that machine cannot run chats or tasks. To run work on a machine, add it as a paired computer."
        actions={
          <Button size="xs" variant="outline" disabled={!ready} onClick={() => setRequest({})}>
            <PlusIcon data-icon="inline-start" />
            Inspect over SSH
          </Button>
        }
      >
        {state === "missing" ? (
          <div {...stylex.props(styles.pad)}>
            <Alert role="status" data-testid="inventory-missing">
              <AlertTitle>Machine inventory is not available</AlertTitle>
              <AlertDescription>This Burf agent is older than machine inventory. Update Burf on this computer to see what runs on your machines.</AlertDescription>
            </Alert>
          </div>
        ) : state === "loading" ? (
          <div role="status" aria-label="Reading machines" {...stylex.props(styles.pad)}>
            {[0, 1].map((i) => (
              <div key={i} {...stylex.props(styles.bone)}>
                <Skeleton />
              </div>
            ))}
          </div>
        ) : state === "failed" && machines.length === 0 ? (
          <div {...stylex.props(styles.pad)}>
            <Alert variant="error" role="status">
              <CircleAlertIcon />
              <AlertTitle>Machines could not be read</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                {/* Named in full: the page's own Retry belongs to an offline computer. */}
                <Button size="xs" variant="outline" onClick={() => void loadMachines()}>
                  Read machines again
                </Button>
              </AlertAction>
            </Alert>
          </div>
        ) : machines.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ServerIcon />
              </EmptyMedia>
              <EmptyTitle size="base">No machines yet</EmptyTitle>
              <EmptyDescription>Pair a computer, or inspect one over SSH, to see what runs on it.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          machines.map((m) => (
            <SettingsRow
              key={m.id}
              label={
                <span {...stylex.props(styles.name)}>
                  {m.name}
                  {sshOnly(m) && <Badge variant="outline">SSH only</Badge>}
                </span>
              }
              description={m.routes.map(routeLabel).join(" · ") || "No route"}
            >
              {sshOnly(m) && (
                <Button size="xs" variant="outline" aria-label={`Open ${m.name}`} onClick={() => useStore.getState().setView({ kind: "machine", id: m.id })}>
                  Open
                </Button>
              )}
              <Button size="xs" variant="ghost" aria-label={`Add a route to ${m.name}`} onClick={() => setRequest({ machine: m })}>
                Add route
              </Button>
            </SettingsRow>
          ))
        )}
      </SettingsGroup>
      <InspectSshDialog open={!!request} machine={request?.machine} onClose={() => setRequest(undefined)} />
    </>
  );
}

// InspectSshDialog is the form in its own dialog, wherever it is offered:
// Settings, and Add computer as a step apart from installing the daemon.
// machine is one Burf already lists, to add a route to. Closing drops what
// was typed; onSaved follows a machine or route that was saved.
export function InspectSshDialog({ open, machine, onClose, onSaved }: { open: boolean; machine?: Machine; onClose(): void; onSaved?(): void }) {
  const machines = useMachines((s) => s.machines);
  const done = () => {
    onClose();
    onSaved?.();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPopup>{open && <RouteForm key={machine?.id ?? NEW} initial={machine} machines={machines} onDone={done} />}</DialogPopup>
    </Dialog>
  );
}

interface Choice {
  value: string;
  label: string;
}

// GroupedSelect is a Select over plain string values, its items in groups.
function GroupedSelect({ label, value, onChange, groups, placeholder, invalid }: { label: string; value: string; onChange(v: string): void; groups: { label?: string; options: Choice[] }[]; placeholder?: string; invalid?: boolean }) {
  const filled = groups.filter((g) => g.options.length > 0);
  const options = filled.flatMap((g) => g.options);
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <Select items={options} value={selected} onValueChange={(o: Choice | null) => onChange(o?.value ?? "")}>
      <SelectTrigger aria-label={label} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectPopup>
        {filled.map((g, i) => (
          <SelectGroup key={g.label ?? i}>
            {g.label && <SelectGroupLabel>{g.label}</SelectGroupLabel>}
            {g.options.map((o) => (
              <SelectItem key={o.value} value={o}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectPopup>
    </Select>
  );
}

function RouteForm({ initial, machines, onDone }: { initial?: Machine; machines: Machine[]; onDone(): void }) {
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const [machineId, setMachineId] = useState(initial?.id ?? NEW);
  const [name, setName] = useState("");
  const [os, setOs] = useState<OsChoice>("");
  const [kind, setKind] = useState<RouteChoice>("ssh");
  const [target, setTarget] = useState("");
  const [box, setBox] = useState(boxes[0]?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const existing = machines.find((m) => m.id === machineId);
  const paired = !!existing && kind === "paired";
  const targetError = paired ? undefined : sshTargetError(target);
  // An empty target is not yet a mistake; the action stays off until it is filled.
  const targetInvalid = !!targetError && target.trim() !== "";
  const noBox = paired && boxes.length === 0;
  const ready = !!(existing || name.trim()) && (paired ? !!box : !targetError);

  const submit = async () => {
    const client = useStore.getState().client;
    if (!client || !ready || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const saved = existing
        ? await inventoryApi.setRoutes(client, existing.id, withRoute(existing.routes, paired ? { kind: "paired", target: box } : { kind: "ssh", target: target.trim() }))
        : await inventoryApi.register(client, { name: name.trim(), os: os || undefined, target: target.trim() });
      await loadMachines();
      toastManager.add({ title: existing ? `Added a route to ${saved.name}` : `Inspecting ${saved.name} over SSH`, type: "success" });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      // A request that failed on the way back may still have been applied.
      void loadMachines();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{initial ? `Add a route to ${initial.name}` : "Inspect over SSH"}</DialogTitle>
        <DialogDescription>
          Burf reads what runs on the machine over SSH. This does not install Burf's daemon: chats and tasks cannot start on a machine that is only inspected.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel stack={4}>
        <FieldGroup>
          <Field>
            <FieldLabel>Machine</FieldLabel>
            <GroupedSelect
              label="Machine"
              value={machineId}
              onChange={setMachineId}
              groups={[{ options: [{ value: NEW, label: "New machine" }] }, { label: "Machines Burf lists", options: machines.map((m) => ({ value: m.id, label: m.name })) }]}
            />
            <FieldDescription>Burf never merges machines by name. To reach a machine it already lists another way, choose that machine.</FieldDescription>
          </Field>
          {existing ? (
            <Field>
              <FieldLabel>Route</FieldLabel>
              <PickOne label="Route" value={kind} onChange={(value) => { const option = ROUTE_OPTIONS.find((o) => o.value === value); if (option) setKind(option.value); }} options={ROUTE_OPTIONS} />
            </Field>
          ) : (
            <>
              <Field>
                <FieldLabel>Name</FieldLabel>
                <Input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Operating system</FieldLabel>
                <PickOne label="Operating system" value={os} onChange={(value) => { const option = OS_OPTIONS.find((o) => o.value === value); if (option) setOs(option.value); }} options={OS_OPTIONS} />
              </Field>
            </>
          )}
          {paired ? (
            <Field invalid={noBox}>
              <FieldLabel>Paired computer</FieldLabel>
              <GroupedSelect label="Paired computer" value={box} onChange={setBox} groups={[{ options: boxes.map((b) => ({ value: b.name, label: b.name })) }]} placeholder="None paired" invalid={noBox} />
              <FieldDescription>Burf's agent checks the pairing before it attaches it to {existing?.name}.</FieldDescription>
              {noBox && <FieldError match>Pair a computer first; there is none to attach.</FieldError>}
            </Field>
          ) : (
            <Field invalid={targetInvalid}>
              <FieldLabel>SSH target</FieldLabel>
              <Input aria-label="SSH target" aria-invalid={targetInvalid || undefined} mono value={target} placeholder="user@host" onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
              <FieldDescription>user@host, or an alias from your SSH configuration. Burf connects with your own keys.</FieldDescription>
              {targetInvalid && <FieldError match>{targetError}</FieldError>}
            </Field>
          )}
        </FieldGroup>
        {error && (
          <Alert variant="error" data-testid="route-error">
            <CircleAlertIcon />
            <AlertTitle>{existing ? "The route was not added" : "The machine was not added"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
        <Button loading={saving} disabled={!ready} onClick={() => void submit()}>
          {existing ? "Add route" : "Inspect over SSH"}
        </Button>
      </DialogFooter>
    </>
  );
}
