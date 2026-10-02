# The app's API

The desktop app is only a view. It talks to the laptop agent (`berth agent`,
started on demand by the CLI or the app), which holds the connections to
every box. Closing the app, or the app crashing, never stops an agent session
or a forward.

## Transport

The agent serves the app on `http://127.0.0.1:1378`.

- **Token.** Every request carries `Authorization: Bearer <token>`. WebSocket
  requests, which cannot set headers from a browser, pass `?token=<token>`
  instead. The token is in `<state>/client/ui-token` (mode 0600); the Tauri
  shell reads it with the `ui_endpoint` command, which returns
  `{ "url": "http://127.0.0.1:1378", "token": "…" }`. For browser-only UI
  work, `berth ui-token` prints the same JSON.
- **Host check.** Requests whose `Host` is not `127.0.0.1:1378` or
  `localhost:1378` are refused, so a web page cannot reach the agent through
  DNS rebinding.
- **CORS.** Allowed origins are `tauri://localhost`, `http://tauri.localhost`
  and `http://localhost:1420` (Vite in development).

## Laptop

| Method and path | Returns |
| --- | --- |
| `GET /v1/status` | `{ boxes: BoxStatus[], forwards, routes, proxy }` |
| `GET /v1/events` | Server-sent events: one `data: <Event JSON>` per event, from this laptop and every online box (box events carry `box`) |
| `POST /v1/forwards` | `{ box, local, remote }` → the forward |
| `DELETE /v1/forwards/{id}` | the removed forward |
| `GET /v1/themes` | `Theme[]`: built-in, `~/.berth/themes/*.json`, and plugins' |
| `GET /v1/templates` | `TaskTemplate[]` from `~/.berth/templates/*.json` |
| `GET /v1/plugins` | `PluginInfo[]` from `~/.berth/plugins/*/berth-plugin.json` |
| `GET /v1/plugins/{id}/{file}` | a file from that plugin's folder (its `main` module, assets) |
| `GET /v1/queue` | `QueueItem[]`: prompts waiting for their box, oldest first |
| `POST /v1/queue` | `{ id?, box, session, text, wait?, enter? }` → `QueueItem`; the same `id` again returns the item already queued |
| `PATCH /v1/queue/{id}` | `{ box?, session?, text? }` → `QueueItem`: move or edit one; it goes back in line as `queued` |
| `POST /v1/queue/{id}/retry` | `QueueItem`: a failed one back in line |
| `POST /v1/queue/{id}/send` | `QueueItem` with `state` `delivered`, `failed` or `queued`: send it now, without waiting for the agent's turn; 409 while its box is offline |
| `DELETE /v1/queue/{id}` | the discarded `QueueItem`; 409 while it is being sent |

`QueueItem` is the offline prompt queue's entry ([orchestration.md](orchestration.md#when-a-box-is-away)):
`{ id, box, session, text, enter, wait, state, error?, created, attempts?,
last_attempt?, blocked?, seq }`. `state` is `queued` (waiting for the box),
`waiting` (the box is back; waiting for the agent's turn to end), `sending`,
or `failed` with `error`. `blocked` marks one held behind an earlier failed
prompt to the same session. `wait` (default true) holds a prompt while the
agent is mid-turn; `enter` (default true) presses Enter after it.

## Boxes

`ANY /v1/boxes/{box}/api/{path}` is passed to the box as `/v1/{path}`, query
string and body included, and the box's answer is streamed back. When the
box cannot be reached the agent answers itself: **503** when the request
never reached the box (safe to retry or queue), **502** when the connection
failed after it went out (the box may have acted on it). The box API:

| Method and path | Returns |
| --- | --- |
| `GET locations` | `Location[]`, each with its `worktrees` |
| `POST locations` | `{ name, path }` → `Location` |
| `DELETE locations/{name}` | |
| `POST locations/{name}/worktrees` | `{ name, branch?, base? }` → `Worktree`; runs the setup script |
| `DELETE locations/{name}/worktrees/{wt}?force=1` | |
| `GET sessions` | `Session[]` |
| `POST sessions` | `{ name?, location: "loc" or "loc/wt", command? }` → `Session` |
| `DELETE sessions/{name}` | |
| `GET sessions/{name}/screen?history=N` | `{ screen: string }` |
| `POST tasks` | `{ location, name, branch?, base?, agent?, command?, prompt? }` → `{ worktree, session }`: a worktree with an agent already running in it |
| `GET stats` | `Stats`: memory, disks, load, agents |
| `GET services` | `Service[]`: listening ports by worktree |
| `GET ports` | `Port[]` |
| `GET info` | `{ name, os, arch, build, tools: string[], agents: AgentPreset[] }` |
| `GET doctor` | `Check[]` |
| `POST secrets/test` | `{ ref }` → `{ ok, length?, error? }`: resolves a [secret reference](templates.md#secrets) on the box now (`op://…` or `env://…`), skipping its cache, and reports whether it could and the value's length, never the value. A malformed reference is `ok: false` with why |
| `POST secrets/report` | Only on the box's own socket: what `berthd secret exec` resolved for a session or service, which variables resolved and which failed and why, never values |

`Session` carries the agent's state when an agent tool reports it:
`agent` (`claude`, `codex`, …) and `agent_state` (`idle`, `running`,
`waiting`, `finished`). `exited` is true once the program has ended.

`GET locations/{name}/config` and `GET env` return secret references as
written, never their values.

## Terminals

`GET /v1/boxes/{box}/sessions/{name}/attach?cols=C&rows=R&token=T` upgrades
to a WebSocket.

- Box → app: binary messages, raw terminal output.
- App → box: binary messages are keystrokes; text messages are JSON
  `{"type":"resize","cols":C,"rows":R}`.

Closing the socket detaches; the session keeps running on the box. Attaching
again redraws the screen, so the app reconnects after sleep or a network
change by opening a new socket.

## Events

```json
{ "type": "agent.waiting", "time": "…", "box": "devl", "origin": "claude",
  "data": { "path": "/home/me/work/cal-billing", "session_id": "…" } }
```

Types the app reacts to: `box.connected`, `box.disconnected`,
`location.*`, `worktree.created`, `worktree.removed`,
`worktree.setup.{started,finished,failed}`, `session.started`,
`session.stopped`, `agent.ready`, `agent.started`, `agent.waiting`, `agent.finished`,
`share.*`, `forward.*`, `queue.changed`, `queue.delivered` and
`queue.failed` (`id`, `box`, `session`, and `reason` on a failure; never the
prompt), and `secret.failed` / `secret.resolved` (`location`,
`name`, `path`, `variable`, `ref`, and `reason` on a failure; never a value).
