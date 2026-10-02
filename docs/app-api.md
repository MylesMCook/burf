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

## Boxes

`ANY /v1/boxes/{box}/api/{path}` is passed to the box as `/v1/{path}`, query
string and body included, and the box's answer is streamed back. The box API:

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
| `GET info` | `{ name, version, tools: string[], agents: AgentPreset[] }` |
| `GET doctor` | `Check[]` |

`Session` carries the agent's state when an agent tool reports it:
`agent` (`claude`, `codex`, …) and `agent_state` (`running`, `waiting`,
`finished`). `exited` is true once the program has ended.

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
`session.stopped`, `agent.started`, `agent.waiting`, `agent.finished`,
`share.*`, `forward.*`.
