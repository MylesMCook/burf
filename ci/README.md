# Development checks and delivery

Use the dev server while editing. `scripts/check-local.sh` selects checks from
changed paths: app types and units, affected browser files, and Go packages in
their owning module. Native Go files never run as packages of the root module.
Module lock changes run a small smoke set locally; full suites run on main.

Pull requests run quick checks. Native changes also run portable browser
ownership tests and compile/vet the Windows bridge without GTK. Main runs the
full browser and Go race suites and native Mac/Windows checks. These jobs report
failures without holding up the edit loop. Mac and Windows jobs cache both Go
lockfiles, the build cache actually used by packaging, and the pinned Wails CLI.

Browser shards download one frontend artifact named for the workflow commit.
The artifact contains the UI manifest and file hashes. Each shard verifies the
commit, shell and every hash before serving it, then runs the same
bytes, rather than rebuilding and type-checking them three more times.

## Act

Act is for reproducing a selected Linux workflow job. Use the installed Act
skill to inspect the machine, its existing configuration/runtime, and the whole
job before running it. Keep an explicit event, workflow and job; never use bare
`act`. An ordinary test run has empty credential/input files, an explicitly empty
`GITHUB_TOKEN`, no mounted Docker socket or cache/artifact listener, existing
pinned images, bounded CPU/memory/concurrency and an external process deadline.

A quick credential-free selection is `pull_request`, `.github/workflows/ci.yml`,
job `changes`. It runs the path-selector and module-boundary assertions. Act's
checkout-copy path does not retain usable Git metadata for a linked worktree;
use a disposable standalone clone of the prepared commit when the job uses Git.
A list or dry-run validates selection, not tests. Linux containers do not verify
native Mac/Windows execution or signed-in providers.

## Fleet delivery

Verified frontend increments use `scripts/ship-ui.sh` with the hosts in local
`tasks.md`. The client checks the UI manifest, hashes and shell contract, and
`burf ui rollback` restores the previous interface. Native changes use the Go
packaging scripts and a staged rollback on each machine. Do not replace a running
agent or migrate state merely because an artifact built successfully.

CI produces test artifacts. Signed publication and the updater remain disabled.
Fleet deployment is performed through the owner's authorized machine connections;
credentials and live service access are not added to the pull-request workflow.
