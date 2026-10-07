# Maintained Windows Fork

This fork adds native Windows desktop workflows to Berth. The upstream project
is now [Shipyard](https://github.com/cosscom/shipyard). Original authorship and
the MIT license are retained. Go module paths remain unchanged to keep the
patches small and upstream contributions straightforward.

## First Milestone

- This computer appears alongside the paired remote computers.
- Existing local Codex and Claude Code conversations are discoverable by
  project and readable without modifying their source files.
- Imported history is read-only. It is not represented as a running agent,
  and opening it never resumes or takes over another application's process.
- Installed native agent CLIs can run in a Berth-owned Windows terminal,
  receive input, resize, and stop without affecting externally started agents.
- Local sessions belong to the client backend. They survive closing a view,
  but stop when that backend stops. They do not yet provide tmux-like recovery
  after a backend crash or restart.
- Remote Mac and Linux sessions continue to use the existing box protocol.

Local transcript discovery does not fetch cloud-only conversations. Agent
authentication and permission prompts remain the installed CLI's responsibility.
The fork does not install CLIs, bypass agent approvals, or change host security.

## Updates

Keep `upstream` pointing to the original project and `origin` pointing to this
fork. Fetch upstream changes into a review branch, merge, then run the existing
Unix regression checks and native Windows acceptance tests before adopting them.
Keep local-machine support and packaging changes in separate commits where
practical; propose generally useful fixes upstream independently.

Development Windows builds use `VITE_BERTH_FORK=true` and must not consume the
official Berth update feed. Signed fork releases and an independent update feed
are separate release work. Do not ship a fork build with the upstream updater
enabled.

## Verification

Synthetic transcript fixtures must cover discovery, read-only pagination,
malformed files and path containment. Native terminal tests must verify output,
input, resizing and owned-process cleanup on Windows, not just cross-compilation.
App acceptance tests must cover unavailable CLIs, read-only history and terminal
reconnection. A successful cross-build is not evidence of native execution or
desktop usability.
