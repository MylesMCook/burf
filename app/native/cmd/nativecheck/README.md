# Native desktop smoke

The controller builds and runs this command, not implementation workers:

```sh
cd app/native
go build -o /private/tmp/burf-nativecheck ./cmd/nativecheck
/private/tmp/burf-nativecheck
```

On Windows, build `nativecheck.exe` from this same directory and place the
verified, matching-architecture `WebView2Loader.dll` beside it. Run it as the
ordinary signed-in user. Do not use an elevated SSH token.

On macOS, run it from a temporary app bundle with a unique bundle identifier.
Both the SDK and the raw adapter currently use the application's default
WebKit data store, so running inside the installed Burf bundle would reuse its
browser state. Windows profiles, synthetic agent state and the loopback server
are temporary. The command never connects to the agent endpoint it checks.

The window is hidden. The deadline is 15 seconds. The final JSON and exit code
require the actual Wails marker, CSP, `ui_state` and `ui_endpoint` binding calls;
raw-view isolation and a refused cross-origin private RPC; inert frames,
evaluation, console and picker capture; navigation, back, forward and reload;
canceled evaluation, bounds/hide/show calls, idempotent close and shutdown.
No token, page content or binding result is printed.

Blank-popup support, isolation and an immediate `window.close()` result are
reported under `observed`, outside the required checks. That observation does
not verify provider sign-in, cookie persistence, visible placement, inspector,
or a pending evaluation canceled during a document change. Bounds/hide/show
checks prove native calls returned successfully, not visual placement.
