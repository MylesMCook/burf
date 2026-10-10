# Native builds

Burf's desktop shell uses the pinned Wails v3 Go module and matching frontend
runtime in `app/native/go.mod` and `app/package.json`. Rust is not part of the
desktop build. The root Go CLI and daemon module stays separate from the GUI.

Restore the locked frontend dependencies with `cd app && pnpm install
--frozen-lockfile`. Use `make app-dev` for Vite's edit loop. Native shell changes
need an explicit build:

```sh
make app-build                                      # macOS host architecture
make app-build APP_GOARCH=universal VERSION=0.3.12   # macOS arm64 and amd64
scripts/native-build.sh windows amd64               # cross-build app folder
```

On Windows, `scripts/windows-build.ps1 -Architecture amd64 -StageOnly` builds
the Go app and ZIP archives. Omit `-StageOnly` to also compile the project-owned
NSIS installer with an existing `makensis.exe`. The script never installs NSIS
or the WebView2 runtime. `NSIS_COMPILER` may name an existing absolute compiler
path. Windows ARM64 uses `-Architecture arm64`.

The Wails CLI is restored into `bin/tools`, with a project-local Go build cache,
and its exact version is checked. `WAILS3` may name an existing absolute CLI
path of that version. `make app-bindings` regenerates TypeScript bindings through
the CLI. `native-prepare.mjs` copies the canonical shortcut table, reviewed
Windows PATH command, and built frontend into the Go embed paths before build.
Generated embeds and Windows `.syso` files are not source files.

Outputs are in `dist/native/darwin-<architecture>/Burf.app` and its DMG, or
`dist/native/windows-<architecture>/`. Windows ZIPs and installers are in
`dist/windows/`. The Mac shell requires macOS 13 or newer;
the app keeps `dev.myles.burf` and `berth://` links. Windows keeps
`dev.myles.berth.windows`, `berth-cli.exe`, `cli/berth.exe`, the current-user
installer, and the existing HKCU Berth PATH ownership key. Fresh installation
does not opt into a login task or PATH changes. Upgrades inspect, drain, and
recover only the installed client's owned process and task.

Windows bundles the loader from Microsoft.Web.WebView2 SDK `1.0.4258.31`.
The package and architecture-specific loader SHA256 digests are pinned in
`webview2-loader.mjs`; its license and notice ship beside `WebView2Loader.dll`.
`WEBVIEW2_SDK_PACKAGE` may point to the exact cached NuGet package. A Windows
build also requires a valid Microsoft Authenticode signature. Cross-building
and digest checks alone do not establish Windows trust or runtime behavior.

`scripts/mac-release.sh vX.Y.Z` signs and notarizes with existing approved Apple
credentials, then verifies the app, DMG, archived app and bundled executables.
`--no-notarize` produces a signed local artifact only. No build or packaging
command installs an app, changes a service, publishes a release, or enables the
updater. Windows publication stays deferred until a signing workflow is approved.
Linux boxes retain the Go daemon; the new desktop's native Browser adapters
currently cover macOS and Windows.

Packaging checks are fast and do not launch an app:

```sh
node --test scripts/native-packaging.test.mjs scripts/windows-installer-template.test.mjs scripts/windows-packaging.test.mjs scripts/ci-changes.test.mjs
bash -n scripts/native-build.sh scripts/mac-release.sh scripts/publish.sh
```

Native builds and installed-client checks belong to the controller. Browser
fixtures and cross-builds do not prove native WebView, login, menu or persistence
behavior. See the [Wails macOS](https://v3.wails.io/guides/build/macos/) and
[Windows](https://v3.wails.io/guides/build/windows/) packaging guides; command
flags are checked against the project's pinned CLI.
