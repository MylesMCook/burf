# Machine inventory

The daemon keeps `box/inventory.db`; the client agent keeps
`client/inventory.db` under the existing OS state directory or `BERTH_HOME`.
These databases contain observations, never service definitions or credentials.
Both use the same package, private state permissions, WAL, and transactional
schema versioning. A damaged or newer database is preserved and inventory
becomes unavailable without disabling established chat or service APIs.

Machines have stable IDs. Their routes can be local, paired daemon fingerprints,
or existing OpenSSH aliases. Exact route ownership is unique. Attaching a route
explicitly can combine machine records and their cached history; names never
cause a merge. SSH queries require known host keys, noninteractive authentication,
and disable configured forwards and local hooks. They install nothing remotely.
Docker queries force a verified local socket rather than following remote contexts.

Complete source scans reconcile absent services as disappeared. Partial scans
update only visible services. Failed scans preserve all previous source values
and their timestamps. Health is independent of process state. History records
changes, with observation times and collection gaps; it is retained for 30 days.
Latest service records remain available. No raw commands, environment, output,
chat contents, or continuous metrics are stored.

An engine coalesces refreshes, runs up to four collectors concurrently, bounds
each machine scan, and polls each machine a minute after its successful scan.
Failure retries back off to at most 16 minutes. Explicit refresh bypasses backoff.
Paired-daemon inventory is authoritative. The client commits remote history pages
and their cursors together, so interrupted synchronization resumes without replay.
SSH-only history covers periods when the client agent runs; collection gaps do
not establish an exact failure time.

Existing service/process routes retain their contracts. New daemon endpoints are
`GET /v1/inventory` and `GET /v1/inventory/history`, gated by `inventory.v1`.
The inventory GET accepts `refresh=1` to refresh observations. Client machine APIs
provide registration, explicit route attachment, snapshots, history and refresh.
The CLI offers `burf machines` and `burf services ... --machine ID`; legacy
`burf services BOX` continues to list the box's dev servers.

Run focused checks:

```sh
go test ./internal/inventory
go test ./internal/agent ./internal/box ./cmd/burf -run Inventory
GORACE=atexit_sleep_ms=0 go test -race ./internal/inventory
```

Real collection proof is separate and explicitly read-only:

```sh
BURF_INVENTORY_PROOF=1 go test -tags burf_inventory_proof ./internal/inventory -run TestInventoryLiveProof -v
```

For an SSH proof, also set `BURF_INVENTORY_SSH` to an existing verified alias and
`BURF_INVENTORY_OS` to `linux`, `darwin` or `windows`. Proof writes only an isolated
temporary database and reports coverage/counts. Fixture tests and cross-builds
do not establish actual collection on another OS.

`Store.Backup` produces a consistent standalone snapshot without copying live
WAL files. Its restore is exercised against temporary SQLite databases. Any
future schema change must preserve a verified backup and restore path first.
