# Native feedback

In an updated Burf desktop app, open **Settings > Developer > Enable feedback**.
Annotate the trusted app window using Agentation. Adding a comment saves it
immediately for the connected task; a separate Send action is not required.
Browser panes receive no feedback bridge or application bindings.

Feedback starts off on every normal app launch. Disable feedback removes the
toolbar and closes its private listeners and streams. Saved comments remain
on this computer. Enabling again rotates the private capability and restores
saved comments. The installed app uses Go and embedded assets; enabling does
not start Node, a development server, or another Burf window.

Connect Codex once from your checkout:

```sh
pnpm --dir app feedback:connect
```

Open a new Codex task after connecting. Ask it to use the Wails watch-and-fix
workflow to read comments, verify fixes and resolve comments after verification.
The existing stdio client follows enabled app restarts and new private ports.
It also discovers tools while Burf is closed. The Codex-side client requires
Node and the checkout's pinned `agentation-mcp` dependency; the app does not.

The normal app publishes a private discovery record under the original agent
home's `client/native-feedback`. The client reads it per request, authenticates
to its loopback-only backend, starts no app or service, and never retries an
interrupted write. Check comment status before repeating an uncertain change.
Multiple app windows cannot own the same feedback store concurrently.

For development with hot reload, keep a terminal open after running:

```sh
pnpm --dir app dev:feedback
```

This explicit development run retains its separate private profile and
companion. A newer active development run takes precedence in the same Codex
connection. `--inspect` adds development-only native inspection. Normal builds
include the lazily loaded feedback toolbar and dormant Go controller, while
excluding the development inspector and companion startup.

Disconnect safely, preserving comments:

```sh
pnpm --dir app feedback:disconnect
```

Setup and disconnect are safe to rerun and refuse to replace an unrelated MCP
registration. Registration is local to the computer running Codex. Other MCP
clients can launch `node app/wails-feedback/mcp.mjs` from the repository root.
