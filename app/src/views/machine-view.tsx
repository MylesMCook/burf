import * as stylex from "@stylexjs/stylex";
import { CircleAlertIcon, ServerOffIcon } from "lucide-react";

import { MachineInventory } from "@/components/inventory/machine-inventory";
import { loadMachines, useLoadMachines, useMachines } from "@/components/inventory/use-inventory";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { routeLabel, sshOnly } from "@/lib/inventory";
import { openSettings } from "@/views/settings/settings-view";
import { ViewHeader } from "@/views/view-header";

const styles = stylex.create({
  page: { display: "flex", height: "100%", minWidth: 0, flexDirection: "column" },
  body: { minHeight: 0, flexGrow: 1, overflowY: "auto", paddingTop: 16, paddingBottom: 64, paddingLeft: 24, paddingRight: 24 },
  measure: { display: "flex", flexDirection: "column", gap: 16, maxWidth: "48rem" },
  bone: { height: 32 },
});

// MachineView is a machine Burf reaches only over SSH. There is no daemon
// on it, so the page has its services and nothing to start: no chat, task
// or project control.
export function MachineView({ id }: { id: string }) {
  useLoadMachines();
  const machine = useMachines((s) => s.machines.find((m) => m.id === id));
  const state = useMachines((s) => s.state);
  const error = useMachines((s) => s.error);
  const settings = (
    <Button size="sm" variant="outline" onClick={() => openSettings("boxes")}>
      Paired computers
    </Button>
  );

  if (!machine) {
    return (
      <div {...stylex.props(styles.page)}>
        <ViewHeader title="Machine" actions={settings} />
        <div {...stylex.props(styles.body)}>
          <div {...stylex.props(styles.measure)}>
            {state === "loading" ? (
              <div role="status" aria-label="Reading machines" {...stylex.props(styles.bone)}>
                <Skeleton />
              </div>
            ) : state === "ready" ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ServerOffIcon />
                  </EmptyMedia>
                  <EmptyTitle>This machine is no longer listed</EmptyTitle>
                  <EmptyDescription>Burf's agent has no machine with this identity. Paired computers lists the machines it knows.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Alert variant="error">
                <CircleAlertIcon />
                <AlertTitle>Machines could not be read</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <AlertAction>
                  <Button size="xs" variant="outline" onClick={() => void loadMachines()}>
                    Read machines again
                  </Button>
                </AlertAction>
              </Alert>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.page)}>
      <ViewHeader title={machine.name} description={machine.routes.map(routeLabel).join(" · ")} actions={settings} />
      <div {...stylex.props(styles.body)}>
        <div {...stylex.props(styles.measure)}>
          {sshOnly(machine) && (
            <Alert role="note" data-testid="machine-inspected-note">
              <AlertTitle>Inspected over SSH</AlertTitle>
              <AlertDescription>Burf's daemon is not installed on {machine.name}, so chats and tasks cannot start here. To run work on it, add it as a paired computer.</AlertDescription>
            </Alert>
          )}
          <MachineInventory key={machine.id} machine={machine} />
        </div>
      </div>
    </div>
  );
}
