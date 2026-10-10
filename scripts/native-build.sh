#!/usr/bin/env bash
# Build a local, staged Go/Wails app. This never installs or launches it.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
platform="${1:-$(go env GOOS)}"
arch="${2:-$(go env GOARCH)}"
requested="${3:-dev}"
sidecars_only="${4:-}"
go="${GO:-go}"
case "$platform" in darwin|windows) ;; *) echo "native-build: desktop packaging supports macOS and Windows; Linux daemon builds remain Go-only" >&2; exit 1;; esac
case "$arch" in amd64|arm64|universal) ;; *) echo "native-build: architecture must be amd64, arm64 or universal" >&2; exit 1;; esac
if [ "$arch" = universal ] && [ "$platform" != darwin ]; then echo "native-build: universal is macOS only" >&2; exit 1; fi
if [ "$platform" = darwin ] && [ "$(uname -s)" != Darwin ]; then echo "native-build: macOS shell builds require a Mac and its existing Xcode SDK" >&2; exit 1; fi
version="$(node scripts/native-prepare.mjs version "$requested")"
stamp=dev
[ "$requested" = dev ] || stamp="v$version"
build_id="$(git rev-parse --short=12 HEAD)"
cli_flags="-s -w -X github.com/MylesMCook/burf/internal/version.Version=$stamp"
native_flags="-s -w -X main.version=$version+$build_id"
export GOCACHE="${GOCACHE:-$root/bin/go-cache}"
out="$root/dist/native/$platform-$arch"
mkdir -p "$out"
if [ "$platform" = darwin ]; then
  bundle="$out/Burf.app"
  executables="$bundle/Contents/MacOS"
  resources="$bundle/Contents/Resources"
  mkdir -p "$executables" "$resources"
else
  executables="$out"
  resources="$out"
  mkdir -p "$out/cli"
fi
build_go() { CGO_ENABLED=0 GOOS="$1" GOARCH="$2" "$go" build -trimpath -ldflags "$cli_flags" -o "$4" "$3"; }
for target in amd64 arm64; do
  build_go linux "$target" ./cmd/burfd "$resources/berthd-linux-$target"
  if [ -f "bin/tmux-linux-$target" ]; then cp "bin/tmux-linux-$target" "$resources/"; fi
done
if [ "$platform" = darwin ]; then
  targets="$arch"
  [ "$arch" != universal ] || targets="arm64 amd64"
  for target in $targets; do
    build_go darwin "$target" ./cmd/burf "$out/burf-cli-$target"
    build_go darwin "$target" ./cmd/burfd "$out/berthd-$target"
  done
  if [ "$arch" = universal ]; then
    lipo -create "$out/burf-cli-arm64" "$out/burf-cli-amd64" -output "$executables/burf-cli"
    lipo -create "$out/berthd-arm64" "$out/berthd-amd64" -output "$resources/berthd"
  else
    cp "$out/burf-cli-$arch" "$executables/burf-cli"
    cp "$out/berthd-$arch" "$resources/berthd"
  fi
else
  build_go windows "$arch" ./cmd/burf "$out/berth-cli.exe"
  cp "$out/berth-cli.exe" "$out/burf-cli.exe"
  cp "$out/berth-cli.exe" "$out/cli/burf.exe"
  cp "$out/berth-cli.exe" "$out/cli/berth.exe"
  node scripts/webview2-loader.mjs "$arch" "$out"
fi
[ "$sidecars_only" != --sidecars-only ] || exit 0
node scripts/native-prepare.mjs bindings
node scripts/wails-cli.mjs generate bindings -ts -names -d ../bindings .
(cd app && VITE_BERTH_FORK=true pnpm build)
node scripts/native-prepare.mjs assets
if [ "$platform" = darwin ]; then
  export MACOSX_DEPLOYMENT_TARGET=13.0
  export CGO_CFLAGS="${CGO_CFLAGS:-} -mmacosx-version-min=13.0"
  export CGO_CXXFLAGS="${CGO_CXXFLAGS:-} -mmacosx-version-min=13.0"
  export CGO_LDFLAGS="${CGO_LDFLAGS:-} -mmacosx-version-min=13.0"
  for target in $targets; do
    (cd app/native && CGO_ENABLED=1 GOOS=darwin GOARCH="$target" "$go" build -tags production -trimpath -ldflags "$native_flags" -o "$out/Burf-$target" .)
  done
  if [ "$arch" = universal ]; then lipo -create "$out/Burf-arm64" "$out/Burf-amd64" -output "$executables/Burf"; else cp "$out/Burf-$arch" "$executables/Burf"; fi
  node -e 'const fs=require("fs"); fs.writeFileSync(process.argv[2], fs.readFileSync(process.argv[1], "utf8").replaceAll("@VERSION@", process.argv[3]))' scripts/macos/Info.plist "$bundle/Contents/Info.plist" "$version"
  plutil -lint "$bundle/Contents/Info.plist"
  cp design/branding/exports/burf-app-icon.icns "$resources/icon.icns"
  cp LICENSE "$resources/LICENSE.txt"
  if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
    for binary in "$executables/burf-cli" "$resources/berthd" "$executables/Burf"; do codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$binary"; done
    codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$bundle"
  else codesign --force --deep --sign - "$bundle"; fi
  codesign --verify --deep --strict "$bundle"
  dmg_stage="$(mktemp -d "$out/.dmg-XXXXXX")"
  trap 'rm -rf "$dmg_stage"' EXIT
  ditto "$bundle" "$dmg_stage/Burf.app"
  ln -s /Applications "$dmg_stage/Applications"
  hdiutil create -quiet -ov -volname Burf -srcfolder "$dmg_stage" -format UDZO "$out/Burf-macos-$arch.dmg"
  printf '%s\n' "$bundle"
else
  node scripts/native-prepare.mjs windows "$requested"
  trap 'rm -f "app/native/rsrc_windows_$arch.syso"' EXIT
  node scripts/wails-cli.mjs generate syso -arch "$arch" -icon "$root/design/branding/exports/burf-app-icon.ico" -info "$root/bin/native/windows-info.json" -manifest "$root/bin/native/windows.manifest" -out "rsrc_windows_$arch.syso"
  (cd app/native && CGO_ENABLED=0 GOOS=windows GOARCH="$arch" "$go" build -tags production -trimpath -ldflags "$native_flags -H windowsgui" -o "$out/Burf.exe" .)
  cp LICENSE "$out/LICENSE.txt"
  printf '%s\n' "$out"
fi
