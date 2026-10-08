# Native Windows local continuation acceptance

Use the Mini-owned feature checkout as the source of truth. Record the source
commit and SHA256 of every received artifact. Test binaries and a frontend
archive are development artifacts; they do not constitute a native desktop
build. Keep installer, autostart, update and machine reboot work deferred.

## Synthetic backend checks

Receive these existing-dependency cross-builds in one disposable directory:
`localagent.test.exe`, `localhistory.test.exe`, `localpty.test.exe`,
`agent.test.exe` and `test-windows-continuation.ps1`.

Run from an ordinary user terminal when available:

```powershell
& .\test-windows-continuation.ps1 -Artifacts $PWD.Path
```

Record the runner's machine and elevation output, each suite's result and skips.
The runner disables installed-provider smoke; tests use fake launchers, synthetic
transcripts, temporary state and disposable helper processes. They verify both
providers' argv, preserved sources, deleted/replaced/truncated source rejection,
append compatibility, concurrent fork deduplication, failed launch retry,
cancellation before launch, active-session restart refusal, bounded terminal
I/O, descendant termination and survival of an unrelated synthetic sibling.
The API suite verifies loopback/token guards and source/provider selection.

An elevated SSH run proves native execution under that token. It does not prove
ordinary-user process/ACL behavior or interactive desktop usability. Do not
modify execution policy, install dependencies or change host access for a check.

## Existing ordinary-user receipt

The 2026-10-08 MC-PC synthetic run passed all four suites: 105 top-level
passes and one installed-provider skip. The actual child token was checked:
`elevated=false`, integrity `S-1-16-8192` (medium), session `0`. This verifies
ordinary-user backend process and ACL behavior through the existing Explorer
parent process mechanism. Session 0 does not verify the interactive Windows
desktop. Retain `mcpc-ordinary-native.log` and `mcpc-ordinary-receipt.json`
alongside the source commit and artifact hashes.

## Desktop and installed CLI fork checks

These remain acceptance work. Building or staging a new desktop preview must
preserve the existing app/state and paired computers. Do not replace the running
Work HP preview. Use an existing native build toolchain; obtain approval if new
dependencies or deployment are needed. Never attach to an external chat process.

1. Record actual installed CLI versions and fork help. Codex must support an
   explicit session ID; preserve `--no-daemon` when advertised. Claude must
   support `--resume <id> --fork-session`. Preserve normal permission prompts.
2. With specific approval to invoke the installed providers, create synthetic
   histories in disposable provider homes and an existing temporary project.
   Do not use private chat contents. Record source hashes and original session
   IDs. Any model turn or real prompt needs specific approval.
3. Open each history read-only. Check the selected provider, project, prior
   context, pagination and absence of historical permission controls. Opening
   and refreshing must leave source bytes and timestamps unchanged.
4. Explicitly continue each source. Confirm the CLI creates a different session
   identity, loads the synthetic context and leaves originals unchanged. Inspect
   terminal output, resize, input (only if approved) and owned stop behavior.
5. Repeat clicks and parallel requests: one active owned process per source.
   Simulate launch failure: no retained reservation, then an intentional retry
   succeeds. Remove, truncate, replace or change the discovered source before
   launch: an error appears and no process starts. A normal append stays valid.
6. Leave the view while a launch is pending. Cancellation before launch starts
   no process; after launch, refresh finds the already-owned session. Do not
   assume canceling an HTTP request undoes an operation already accepted.
7. Lose a launch response. Expect an honest possible-start outcome; refresh
   finds an already-owned session and never silently repeats the launch. Lose
   an input response. Expect an honest uncertain outcome. Reconnect reads
   output for the same session and never replays input or creates another agent.
8. Stop an owned agent with a disposable child tree alongside an unrelated
   disposable process. Only the owned tree stops, within the timeout. Restart
   and drain refuse while any owned local agent remains active.
9. Confirm This computer is separate from remote trusted boxes. Tailscale
   reachability alone grants no Berth pairing. Check local/remote identity,
   conflicting box aliases, transcript identity and preview routing. Exercise
   existing remote reconnection without stopping live sessions or services.
10. Record Windows-native GUI evidence for keyboard/clipboard, terminal
    reconnect, responsive history and failures. Mini Playwright screenshots
    prove the mocked frontend on Mini; they do not prove the Windows webview.

Local Windows agents live as long as their client backend. Remote tmux sessions
have a different lifetime and may outlive client closure/reconnection. Neither
contract promises persistence through a full machine reboot. Finish by stopping
only test-owned agents/client state and removing only disposable test state.

The exact proposed installed-provider context, launch limits, privacy boundary
and optional separately approved model turn are in
[WINDOWS-PROVIDER-SMOKE-PROPOSAL.md](WINDOWS-PROVIDER-SMOKE-PROPOSAL.md).
