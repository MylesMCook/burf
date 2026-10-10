import * as stylex from "@stylexjs/stylex";
import { BellIcon, ChevronDownIcon, PackageIcon, PlusIcon, ShieldIcon } from "lucide-react";
import { useState } from "react";

import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { load, save } from "@/lib/storage";
import { STARTERS, type Starter } from "@/views/automations/catalog";
import { EventsPanel, EventsRail } from "@/views/automations/events-panel";
import { type Editing, HookSheet } from "@/views/automations/hook-sheet";
import { HooksTable } from "@/views/automations/hooks-table";
import { LAPTOP, useHooks } from "@/views/automations/use-hooks";
import { color, radius } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
  },
  s1: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s2: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "4px",
    "paddingBottom": "12px",
  },
  s3: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s4: {
    "opacity": 0.6,
  },
  s5: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "12px",
    "paddingBottom": "40px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "20px",
    },
  },
  s6: {
    "marginBottom": "8px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "display": "grid",
    "gridTemplateColumns": "repeat(auto-fill,minmax(240px,1fr))",
    "gap": "8px",
  },
  s8: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s9: {
    "minWidth": "0px",
  },
  s10: {
    "display": "block",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s11: {
    "display": "block",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "marginTop": "8px",
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },

  s13: {
    display: "flex",
    height: "100%",
    minHeight: 64,
    width: "100%",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: color.border, ":hover": "color-mix(in oklab, var(--ring) 40%, transparent)" },
    backgroundColor: color.card,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
    textAlign: "left",
    transitionProperty: "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
    opacity: { ":disabled": 0.5 },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const starterIcons: Record<string, typeof BellIcon> = { notify: BellIcon, deps: PackageIcon, "no-main": ShieldIcon };

const machineLabel = (m: string) => (m === LAPTOP ? "This laptop" : m);
// In a sentence: "on this laptop", "on devl".
const machineInProse = (m: string) => (m === LAPTOP ? "this laptop" : m);

// ShellHooks edits the raw hooks on this laptop and every online box: a
// table per machine, an editor in a side sheet, and the live event stream
// beside them for finding the event to hook. Flows cover most automations;
// these are for anything a shell command does better.
export function ShellHooks() {
  const { machines, byMachine, save: saveHooks } = useHooks();
  const [editing, setEditing] = useState<Editing>();
  const [deleting, setDeleting] = useState<{ machine: string; index: number }>();
  // Under 1280px the events panel starts collapsed to a rail.
  const [showEvents, setShowEvents] = useState(() => load("berth.automations.events", window.innerWidth >= 1280));
  const boxes = machines.filter((m) => m !== LAPTOP);

  const toggleEvents = (on: boolean) => {
    setShowEvents(on);
    save("berth.automations.events", on);
  };

  // write puts one hook into its machine's list (or takes it out) and saves
  // the whole list; a server refusal surfaces in the sheet.
  const write = async (machine: string, index: number | undefined, hook?: Editing["hook"]) => {
    const list = [...(byMachine[machine]?.file?.hooks ?? [])];
    if (index === undefined) list.push(hook!);
    else if (hook) list[index] = hook;
    else list.splice(index, 1);
    await saveHooks(machine, list);
  };

  const add = (machine: string, hook = { on: "", run: "" }) => setEditing({ machine, hook });
  const startFrom = (s: Starter, machine: string) => add(machine, { ...s.hook });

  return (
    <div className={sx(paint.s0)}>
      <div className={sx(paint.s1)}>
        <div className={sx(paint.s2)}>
          <p className={sx(paint.s3)}>Shell commands that run when an event happens. Gates run before an action and can stop it.</p>
          <MachineMenu machines={machines} onPick={(m) => add(m)}>
            <PlusIcon />
            New hook
            <ChevronDownIcon className={sx(paint.s4)} />
          </MachineMenu>
        </div>
        <div className={sx(paint.s5)}>
          <section>
            <h2 className={sx(paint.s6)}>Start from</h2>
            <div className={sx(paint.s7)}>
              {STARTERS.map((s) => {
                const Icon = starterIcons[s.id] ?? PlusIcon;
                const card = (
                  <>
                    <Icon className={sx(paint.s8)} />
                    <span className={sx(paint.s9)}>
                      <span className={sx(paint.s10)}>{s.title}</span>
                      <span className={sx(paint.s11)}>
                        {s.description} {s.where === "laptop" ? "On this laptop." : "On a box."}
                      </span>
                    </span>
                  </>
                );
                const cls = (sx(paint.s13) ?? "");
                if (s.where === "laptop") {
                  return (
                    <button key={s.id} type="button" className={cls} onClick={() => startFrom(s, LAPTOP)}>
                      {card}
                    </button>
                  );
                }
                if (boxes.length === 1) {
                  return (
                    <button key={s.id} type="button" className={cls} onClick={() => startFrom(s, boxes[0])}>
                      {card}
                    </button>
                  );
                }
                return (
                  <Menu key={s.id}>
                    <MenuTrigger disabled={boxes.length === 0} render={<button type="button" className={cls} />}>
                      {card}
                    </MenuTrigger>
                    <MenuPopup align="start">
                      <MenuGroup>
                        <MenuGroupLabel>Which box?</MenuGroupLabel>
                        {boxes.map((b) => (
                          <MenuItem key={b} onClick={() => startFrom(s, b)}>
                            {b}
                          </MenuItem>
                        ))}
                      </MenuGroup>
                    </MenuPopup>
                  </Menu>
                );
              })}
            </div>
          </section>

          {machines.map((m) => (
            <HooksTable
              key={m}
              label={machineLabel(m)}
              data={byMachine[m] ?? { machine: m, loading: true }}
              onAdd={() => add(m)}
              onEdit={(index) => setEditing({ machine: m, index, hook: byMachine[m]!.file!.hooks[index] })}
              onDelete={(index) => setDeleting({ machine: m, index })}
            />
          ))}
        </div>
      </div>

      {showEvents ? (
        <EventsPanel
          onClose={() => toggleEvents(false)}
          onNewHook={(e) => add(e.box ?? LAPTOP, { on: e.type, run: "" })}
        />
      ) : (
        <EventsRail onOpen={() => toggleEvents(true)} />
      )}

      <HookSheet editing={editing} onClose={() => setEditing(undefined)} onSave={(e) => write(e.machine, e.index, e.hook)} />
      <DeleteHook
        target={deleting}
        hook={deleting && byMachine[deleting.machine]?.file?.hooks[deleting.index]}
        onClose={() => setDeleting(undefined)}
        onConfirm={async () => {
          if (deleting) await write(deleting.machine, deleting.index);
          setDeleting(undefined);
        }}
      />
    </div>
  );
}

function MachineMenu({ machines, onPick, children }: { machines: string[]; onPick(m: string): void; children: React.ReactNode }) {
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" />}>{children}</MenuTrigger>
      <MenuPopup align="end">
        <MenuGroup>
          <MenuGroupLabel>Run it on</MenuGroupLabel>
          {machines.map((m) => (
            <MenuItem key={m} onClick={() => onPick(m)}>
              {machineLabel(m)}
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

function DeleteHook({ target, hook, onClose, onConfirm }: { target?: { machine: string }; hook?: { on: string; run: string }; onClose(): void; onConfirm(): Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogPopup width="md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this hook?</AlertDialogTitle>
          <AlertDialogDescription>
            It stops running on {target && machineInProse(target.machine)} straight away.
            {hook && <code className={sx(paint.s12)}>{`${hook.on} → ${hook.run}`}</code>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
