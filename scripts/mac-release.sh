#!/usr/bin/env bash
# Build and verify a signed Go/Wails app and DMG. This does not publish it.
# scripts/mac-release.sh vX.Y.Z [--no-notarize]
# The updater stays disabled: no update feed or updater signing key is used.
set -euo pipefail
requested="${1:?usage: scripts/mac-release.sh vX.Y.Z [--no-notarize]}"
version="${requested#v}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "mac-release: version must be vX.Y.Z" >&2; exit 1; }
[ "$(uname -s)" = Darwin ] || { echo "mac-release: requires macOS" >&2; exit 1; }
notarize=1
[ "${2:-}" != --no-notarize ] || notarize=0
: "${APPLE_SIGNING_IDENTITY:?set the Developer ID Application signing identity}"
if [ "$notarize" = 1 ]; then
  : "${APPLE_API_ISSUER:?set APPLE_API_ISSUER or use --no-notarize}"
  : "${APPLE_API_KEY:?set APPLE_API_KEY or use --no-notarize}"
  : "${APPLE_API_KEY_PATH:?set APPLE_API_KEY_PATH to the existing .p8 file}"
  [ -f "$APPLE_API_KEY_PATH" ] || { echo "mac-release: the API key file is missing" >&2; exit 1; }
fi
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
work="$(mktemp -d)"
mnt="$work/mnt"
cleanup() {
  [ ! -d "$mnt" ] || hdiutil detach -quiet "$mnt" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT
die() { echo "mac-release: $*" >&2; exit 1; }

# Remote helpers are required for distribution, and may already be cached by CI.
scripts/build-tmux.sh bin
make app-build APP_GOOS=darwin APP_GOARCH=universal VERSION="$version"
app="$root/dist/native/darwin-universal/Burf.app"
out="$root/dist/mac"
mkdir -p "$out"

check_app() {
  local application="$1" info executable archs actual
  codesign --verify --deep --strict "$application" || die "app signature does not verify"
  info="$(codesign -dv --verbose=2 "$application" 2>&1)"
  grep -q '^Authority=Developer ID Application:' <<<"$info" || die "app lacks a Developer ID signature"
  grep -Eq '^CodeDirectory .*flags=.*runtime' <<<"$info" || die "app lacks hardened runtime"
  grep -q '^Timestamp=' <<<"$info" || die "app lacks a secure signing timestamp"
  for executable in "$application/Contents/MacOS/Burf" "$application/Contents/MacOS/burf-cli" "$application/Contents/Resources/berthd"; do
    codesign --verify --strict "$executable" || die "bundled executable signature does not verify"
    archs="$(lipo -archs "$executable")"
    [[ " $archs " == *' arm64 '* && " $archs " == *' x86_64 '* ]] || die "bundled executable is not universal: $archs"
    info="$(codesign -dv --verbose=2 "$executable" 2>&1)"
    grep -q '^Authority=Developer ID Application:' <<<"$info" || die "bundled executable lacks a Developer ID signature"
    grep -Eq '^CodeDirectory .*flags=.*runtime' <<<"$info" || die "bundled executable lacks hardened runtime"
    grep -q '^Timestamp=' <<<"$info" || die "bundled executable lacks a secure timestamp"
  done
  for executable in berthd-linux-amd64 berthd-linux-arm64 tmux-linux-amd64 tmux-linux-arm64; do
    [ -f "$application/Contents/Resources/$executable" ] || die "app carries no $executable"
  done
  actual="$(plutil -extract CFBundleShortVersionString raw "$application/Contents/Info.plist")"
  [ "$actual" = "$version" ] || die "app version is $actual instead of $version"
  [ "$(plutil -extract CFBundleIdentifier raw "$application/Contents/Info.plist")" = dev.myles.burf ] || die "app identity changed"
  [ "$(plutil -extract LSMinimumSystemVersion raw "$application/Contents/Info.plist")" = 13.0 ] || die "minimum macOS version changed"
  cp "$application/Contents/Resources/berthd" "$work/berthd-copy"
  codesign --verify --strict "$work/berthd-copy" || die "copied local daemon signature does not verify"
}
notarize_file() {
  local artifact="$1" result status id
  result="$(xcrun notarytool submit "$artifact" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" --wait --timeout 1h --output-format json)" || die "notary submission failed"
  status="$(node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).status||""))' <<<"$result")"
  if [ "$status" != Accepted ]; then
    id="$(node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).id||""))' <<<"$result")"
    [ -z "$id" ] || xcrun notarytool log "$id" --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" >&2 || true
    die "Apple did not accept the artifact (${status:-unknown})"
  fi
}
gatekeeper() {
  local verdict
  verdict="$(spctl -a -vv -t "$1" "$2" 2>&1)" || die "Gatekeeper rejected the artifact: $verdict"
  [[ "$verdict" != *'override=security disabled'* ]] || die "Gatekeeper assessments are disabled; acceptance cannot be verified"
  [[ "$verdict" == *'source=Notarized Developer ID'* ]] || die "Gatekeeper did not accept it as notarized"
}

check_app "$app"
if [ "$notarize" = 1 ]; then
  ditto -c -k --keepParent "$app" "$work/Burf.zip"
  notarize_file "$work/Burf.zip"
  xcrun stapler staple "$app"
  xcrun stapler validate "$app"
  gatekeeper exec "$app"
fi
mkdir -p "$work/dmg"
ditto "$app" "$work/dmg/Burf.app"
ln -s /Applications "$work/dmg/Applications"
dmg="$out/Burf-macos-universal.dmg"
hdiutil create -quiet -ov -volname Burf -srcfolder "$work/dmg" -format UDZO "$dmg"
codesign --force --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$dmg"
codesign --verify --strict "$dmg"
if [ "$notarize" = 1 ]; then
  notarize_file "$dmg"
  xcrun stapler staple "$dmg"
  xcrun stapler validate "$dmg"
  gatekeeper install "$dmg"
fi
mkdir -p "$mnt"
hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mnt" "$dmg"
[ -L "$mnt/Applications" ] || die "DMG has no Applications link"
check_app "$mnt/Burf.app"
if [ "$notarize" = 1 ]; then xcrun stapler validate "$mnt/Burf.app"; gatekeeper exec "$mnt/Burf.app"; fi
hdiutil detach -quiet "$mnt"
COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs -czf "$out/Burf-macos-universal.app.tar.gz" -C "$(dirname "$app")" Burf.app
mkdir "$work/archive"
tar -xzf "$out/Burf-macos-universal.app.tar.gz" -C "$work/archive"
check_app "$work/archive/Burf.app"
if [ "$notarize" = 1 ]; then xcrun stapler validate "$work/archive/Burf.app"; gatekeeper exec "$work/archive/Burf.app"; fi
(cd "$out" && shasum -a 256 Burf-macos-universal.dmg Burf-macos-universal.app.tar.gz > mac-checksums.txt)
if [ "$notarize" = 0 ]; then echo "Signed local artifacts only; notarization was not run."; fi
printf 'Verified Go/Wails macOS artifacts: %s\n' "$out"
