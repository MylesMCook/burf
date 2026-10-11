import * as stylex from "@stylexjs/stylex";
import { CircleAlertIcon, ServerIcon, ServerOffIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { useInventory, useMachine, useServiceHistory } from "@/components/inventory/use-inventory";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetDescription, SheetHeader, SheetPanel, SheetPopup, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ago } from "@/lib/format";
import {
  burfManaged,
  type Coverage,
  coverageText,
  describeChange,
  groupServices,
  HISTORY,
  inventorySummary,
  type Machine,
  type MachineLookup,
  portsText,
  processText,
  routeLabel,
  type Service,
  serviceStatus,
  type ServiceStatus,
  type SourceGroup,
  sourceLabel,
  unreachable,
} from "@/lib/inventory";
import { color, font } from "@/styles/tokens.stylex";

// Layout only: the parts bring their own look.
const styles = stylex.create({
  root: { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 },
  bar: { display: "flex", alignItems: "center", gap: 12 },
  summary: { minWidth: 0, flexGrow: 1, fontSize: 13, color: color.mutedForeground },
  note: { fontSize: 13, lineHeight: 1.5, color: color.mutedForeground },
  loading: { display: "flex", flexDirection: "column", gap: 8 },
  bone: { height: 32 },
  group: { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 },
  heading: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 },
  count: { fontVariantNumeric: "tabular-nums", fontWeight: 400, color: color.mutedForeground },
  pushed: { marginLeft: "auto" },
  badges: { display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 6 },
  detail: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 4, paddingBottom: 4, whiteSpace: "normal", lineHeight: 1.5 },
  facts: { display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr)", columnGap: 16, rowGap: 4, margin: 0, fontSize: 13 },
  fact: { display: "contents" },
  term: { color: color.mutedForeground },
  value: { margin: 0, minWidth: 0, overflowWrap: "anywhere" },
  mono: { fontFamily: font.mono, fontVariantLigatures: "none" },
  history: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, minWidth: 0 },
  wide: { width: "100%" },
});

interface Fact {
  term: string;
  value: ReactNode;
  mono: boolean;
}
const fact = (term: string, value: ReactNode, mono = false): Fact => ({ term, value, mono });

// MachineInventory is what runs on one machine, as the agent last read it:
// its services by collector, how well each collector could be read and how
// long ago, and one service's details and history at a time. Nothing here
// starts or stops anything.
export function MachineInventory({ machine }: { machine: Machine }) {
  const { snapshot, error, scanning, scanError, read, scan } = useInventory(machine.id);
  const [selected, setSelected] = useState<string>();
  const lost = snapshot && unreachable(snapshot);
  const groups = snapshot ? groupServices(snapshot) : [];
  // A collector that read nothing and had nothing to say needs no section.
  const shown = groups.filter((g) => g.services.length > 0 || (g.coverage && g.coverage.state !== "ok"));
  const quiet = groups.filter((g) => !shown.includes(g));
  const history = snapshot?.coverage.find((c) => c.source === HISTORY && c.state !== "ok");

  return (
    <section aria-label={`Services on ${machine.name}`} data-testid="machine-inventory" {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.bar)}>
        <p role="status" data-testid="inventory-summary" {...stylex.props(styles.summary)}>
          {snapshot ? `${inventorySummary(snapshot)} · read ${ago(snapshot.at)}` : error ? "Services unavailable" : "Reading services…"}
        </p>
        <Button size="sm" variant="outline" loading={scanning} onClick={() => void scan()}>
          Scan now
        </Button>
      </div>

      {scanError && (
        <Alert variant="error" data-testid="inventory-scan-error">
          <CircleAlertIcon />
          <AlertTitle>Could not scan {machine.name} now</AlertTitle>
          <AlertDescription>
            {scanError}
            {snapshot && " What was last read is still shown."}
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant={snapshot ? "warning" : "error"} role={snapshot ? "status" : "alert"} data-testid="inventory-read-error">
          <CircleAlertIcon />
          <AlertTitle>{snapshot ? "This may be out of date" : `Services on ${machine.name} could not be read`}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" onClick={() => void read()}>
              Read again
            </Button>
          </AlertAction>
        </Alert>
      )}
      {lost && (
        <Alert variant="warning" role="status" data-testid="inventory-unreachable">
          <ServerOffIcon />
          <AlertTitle>
            {machine.name} could not be reached at the last scan, {ago(lost.at)}
          </AlertTitle>
          <AlertDescription>
            {lost.error && `${lost.error.replace(/[.\s]+$/, "")}. `}
            Services are shown as last seen. They may still be running.
          </AlertDescription>
        </Alert>
      )}
      {history && (
        <Alert variant="warning" role="status">
          <CircleAlertIcon />
          <AlertTitle>Changes are not being recorded</AlertTitle>
          <AlertDescription>{history.error || coverageText(history)}</AlertDescription>
        </Alert>
      )}

      {!snapshot && !error && (
        <div aria-hidden="true" {...stylex.props(styles.loading)}>
          {[0, 1, 2].map((i) => (
            <div key={i} {...stylex.props(styles.bone)}>
              <Skeleton />
            </div>
          ))}
        </div>
      )}
      {snapshot && shown.length === 0 && (
        <Empty data-testid="inventory-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ServerIcon />
            </EmptyMedia>
            <EmptyTitle size="base">{snapshot.coverage.length ? "No services found" : "Not scanned yet"}</EmptyTitle>
            <EmptyDescription>
              {snapshot.coverage.length ? `Nothing is running on ${machine.name} that Burf can see.` : `Scan now to read what runs on ${machine.name}.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {shown.map((g) => (
        <SourceSection key={g.source} machine={machine} group={g} at={snapshot?.at ?? ""} lost={!!lost} selected={selected} onSelect={(id) => setSelected((now) => (now === id ? undefined : id))} />
      ))}
      {quiet.length > 0 && shown.length > 0 && <p {...stylex.props(styles.note)}>Also scanned, nothing found: {quiet.map((g) => sourceLabel(g.source)).join(", ")}.</p>}
    </section>
  );
}

const COVERAGE_BADGE = { ok: "outline", partial: "warning", unavailable: "warning", error: "error" } as const;

// at: when the machine was last scanned. lost: the machine itself was not
// reached, which the page already says once.
function SourceSection({ machine, group, at, lost, selected, onSelect }: { machine: Machine; group: SourceGroup; at: string; lost: boolean; selected?: string; onSelect(id: string): void }) {
  const { source, coverage, services } = group;
  const label = sourceLabel(source);
  return (
    <section aria-label={label} data-testid="inventory-source" data-source={source} {...stylex.props(styles.group)}>
      <h3 {...stylex.props(styles.heading)}>
        {label}
        <span {...stylex.props(styles.count)}>{services.length}</span>
        {coverage && (
          <span {...stylex.props(styles.pushed)}>
            <Badge variant={COVERAGE_BADGE[coverage.state] ?? "outline"} muted={coverage.state === "ok"} data-testid="collector-state" data-state={coverage.state}>
              {coverageText(coverage)}
            </Badge>
          </span>
        )}
      </h3>
      {coverage && coverage.state !== "ok" && !lost && (
        <Alert variant={coverage.state === "error" ? "error" : "warning"} role="status" data-testid="collector-alert">
          <CircleAlertIcon />
          <AlertTitle>{coverage.state === "partial" ? `${label} were only partly read` : `${label} could not be read`}</AlertTitle>
          <AlertDescription>
            {coverage.error ? `${coverage.error.replace(/[.\s]+$/, "")}. ` : ""}
            {services.length ? "What was last seen is still listed." : "Nothing has been seen here yet."}
          </AlertDescription>
        </Alert>
      )}
      {services.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead end>Seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s) => (
              <ServiceRows key={s.id} machine={machine} service={s} at={at} coverage={coverage} open={selected === s.id} onToggle={() => onSelect(s.id)} />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

const STATUS_BADGE = { plain: "outline", muted: "secondary", danger: "error" } as const;

function ServiceRows({ machine, service: s, at, coverage, open, onToggle }: { machine: Machine; service: Service; at: string; coverage?: Coverage; open: boolean; onToggle(): void }) {
  const detail = useId();
  const status = serviceStatus(s, coverage);
  return (
    <>
      <TableRow data-testid="inventory-service" data-service={s.name} data-service-state={s.state} data-state={open ? "selected" : undefined}>
        <TableCell truncate weight={open ? "medium" : undefined}>
          <Button size="xs" variant="link" aria-expanded={open} aria-controls={open ? detail : undefined} onClick={onToggle}>
            {s.name}
          </Button>
        </TableCell>
        <TableCell>
          <span {...stylex.props(styles.badges)}>
            <Badge variant={STATUS_BADGE[status.tone]} data-testid="service-status">
              {status.label}
            </Badge>
            {s.health && (
              <Badge variant="outline" muted data-testid="service-health">
                Health: {s.health}
              </Badge>
            )}
          </span>
        </TableCell>
        <TableCell nums tone="muted">
          {portsText(s.ports)}
        </TableCell>
        <TableCell end nums tone="muted">
          {ago(s.observed_at)}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={4}>
            <ServiceDetail id={detail} machine={machine} service={s} at={at} status={status} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ServiceDetail({ id, machine, service: s, at, status }: { id: string; machine: Machine; service: Service; at: string; status: ServiceStatus }) {
  // Only what the source reported: a missing fact has no row.
  const running = processText(s);
  const facts = [
    fact("Source", sourceLabel(s.source)),
    fact("Status", status.label),
    s.health ? fact("Health", s.health) : undefined,
    s.ports.length ? fact("Ports", portsText(s.ports), true) : undefined,
    running ? fact("Process", running) : undefined,
    s.location ? fact("Location", s.location, true) : undefined,
    s.worktree ? fact("Worktree", s.worktree, true) : undefined,
    fact("Last observed", <time dateTime={s.observed_at}>{`${new Date(s.observed_at).toLocaleString()} (${ago(s.observed_at)})`}</time>),
  ].filter((f): f is Fact => f !== undefined);
  return (
    <div id={id} role="region" aria-label={`${s.name} details`} data-testid="inventory-detail" {...stylex.props(styles.detail)}>
      <dl {...stylex.props(styles.facts)}>
        {facts.map((f) => (
          <div key={f.term} {...stylex.props(styles.fact)}>
            <dt {...stylex.props(styles.term)}>{f.term}</dt>
            <dd {...stylex.props(styles.value, f.mono && styles.mono)}>{f.value}</dd>
          </div>
        ))}
      </dl>
      <p {...stylex.props(styles.note)}>
        {burfManaged(s.source) ? "Burf started this. Stop it or reply to it from its chat or worktree." : "Read only. Burf did not start this, so it reports it and leaves it alone."}
      </p>
      <ServiceHistory key={s.id} machine={machine.id} service={s} at={at} />
    </div>
  );
}

function ServiceHistory({ machine, service, at }: { machine: string; service: Service; at: string }) {
  // A scan, or a newer sighting of the service, may have recorded a change.
  const { changes, more, error, loading, loadMore } = useServiceHistory(machine, service.id, `${at} ${service.observed_at}`);
  return (
    <section aria-label={`History of ${service.name}`} data-testid="inventory-history" {...stylex.props(styles.history)}>
      <h4 {...stylex.props(styles.heading)}>History</h4>
      {!changes && loading && (
        <div aria-hidden="true" {...stylex.props(styles.bone, styles.wide)}>
          <Skeleton />
        </div>
      )}
      {changes?.length === 0 && (
        <Empty pad="none">
          <EmptyHeader>
            <EmptyTitle size="base">No changes recorded yet</EmptyTitle>
            <EmptyDescription>Burf records a change when a scan finds this service in a new state.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {!!changes?.length && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((c) => (
              <TableRow key={c.id} data-testid="inventory-change" data-gap={c.gap || undefined}>
                <TableCell nums tone="muted">
                  <time dateTime={c.at}>{new Date(c.at).toLocaleString()}</time>
                </TableCell>
                <TableCell>
                  <span {...stylex.props(styles.badges)}>
                    {describeChange(c)}
                    {c.gap && <Badge variant="warning">After a gap in scans</Badge>}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {changes?.some((c) => c.gap) && <p {...stylex.props(styles.note)}>After a gap, scans before the change did not see the service, so it may have changed earlier than the time shown.</p>}
      {error && (
        <Alert variant="error">
          <CircleAlertIcon />
          <AlertTitle>History could not be read</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" onClick={() => void loadMore()}>
              Read history again
            </Button>
          </AlertAction>
        </Alert>
      )}
      {more && !error && (
        <Button size="xs" variant="outline" loading={loading} onClick={() => void loadMore()}>
          Load later changes
        </Button>
      )}
    </section>
  );
}

// MachineServices is the Services control in an existing machine view: a
// button that opens this machine's inventory beside the page. It shows only
// once the agent has a record for the machine, so a view on an agent without
// machine inventory looks as it did. The inventory is read while the sheet
// is open and not otherwise.
export function MachineServices({ where }: { where: MachineLookup }) {
  const machine = useMachine(where);
  if (!machine) return null;
  return (
    <Sheet>
      <SheetTrigger render={<Button size="sm" variant="outline" aria-label={`Services on ${machine.name}`} />}>Services</SheetTrigger>
      <SheetPopup width="xl">
        <SheetHeader pad="tight">
          <SheetTitle size="base">Services on {machine.name}</SheetTitle>
          <SheetDescription>{machine.routes.map(routeLabel).join(" · ")}</SheetDescription>
        </SheetHeader>
        {/* Held to the sheet's width: a service with many ports scrolls in its table. */}
        <SheetPanel contentSize="container">
          <MachineInventory key={machine.id} machine={machine} />
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
