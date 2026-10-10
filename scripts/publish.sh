#!/usr/bin/env bash
# Publish a Burf release from this Mac, with the same build the release
# workflow makes in CI:
#
#   make publish VERSION=0.3.0 [NOTES="What changed"]
#
# 1. Sets the version in app/package.json.
# 2. Builds the app universal, signs it with the Developer ID, notarizes and
#    staples it, and checks it (scripts/mac-release.sh), into dist/mac/.
# 3. Commits "chore: release vX", tags, and pushes main and the tag.
# 4. Creates the GitHub release (or adds to it) with the DMG and app archive.
#    The installed-app updater remains disabled.
#
# The tag push starts .github/workflows/release.yml: its release job adds the
# CLI and daemon archives (and checksums.txt) for install.sh; its macos job
# finds the app archive already uploaded and builds nothing.
# Without this script, pushing a v* tag has CI publish the app instead.
#
# Credentials come from the environment, else from 1Password:
#   APPLE_API_ISSUER           "Issuer ID" of op://Personal/Berth Developer Id
#   APPLE_API_KEY              "Key ID" of the same item
#   APPLE_API_KEY_PATH         its AuthKey_<Key ID>.p8, written to a private temp file
#   APPLE_SIGNING_IDENTITY     the one Developer ID Application identity in the keychain
# BERTH_APPLE_OP_ITEM points at another 1Password item.
set -euo pipefail

version="${VERSION:?set VERSION, e.g. make publish VERSION=0.3.0}"
version="${version#v}"
tag="v$version"
repo="MylesMCook/burf"
apple_op="${BERTH_APPLE_OP_ITEM:-op://Personal/Berth Developer Id}"
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

die() { echo "publish: $*" >&2; exit 1; }
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "VERSION must look like 1.2.3"
[ -z "$(git status --porcelain)" ] || die "commit your changes first"
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || die "publish from main"
git rev-parse -q --verify "refs/tags/$tag" >/dev/null && die "$tag is already tagged here"
[ -z "$(git ls-remote --tags origin "refs/tags/$tag")" ] || die "$tag is already tagged on origin"
gh release view "$tag" --repo "$repo" >/dev/null 2>&1 && die "$tag is already released"

op_read() { # op_read REF: a 1Password value, or a clear failure
  command -v op >/dev/null || die "no $2 in the environment, and no 1Password CLI (op) to read it from"
  op read "$1" || die "could not read $2 from 1Password ($1)"
}

[ -n "${APPLE_API_ISSUER:-}" ] || APPLE_API_ISSUER="$(op_read "$apple_op/Issuer ID" "APPLE_API_ISSUER")"
[ -n "${APPLE_API_KEY:-}" ] || APPLE_API_KEY="$(op_read "$apple_op/Key ID" "APPLE_API_KEY")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
if [ -z "${APPLE_API_KEY_PATH:-}" ]; then
  APPLE_API_KEY_PATH="$tmp/AuthKey_$APPLE_API_KEY.p8"
  (umask 077 && op_read "$apple_op/AuthKey_$APPLE_API_KEY.p8" "the App Store Connect API key" >"$APPLE_API_KEY_PATH")
fi
export APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH

# Gatekeeper needs the Developer ID signature and Apple's ticket.
if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
  found="$(security find-identity -v -p codesigning 2>/dev/null | grep -c "Developer ID Application" || true)"
  [ "$found" = 1 ] ||
    die "set APPLE_SIGNING_IDENTITY: found $found Developer ID Application identities, need exactly one to choose automatically"
  APPLE_SIGNING_IDENTITY="$(security find-identity -v -p codesigning | sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -1)"
fi
export APPLE_SIGNING_IDENTITY
echo "Signing as ${APPLE_SIGNING_IDENTITY}…"

echo "Setting version ${version}…"
bumped=(app/package.json)
# Until the release commit exists, a failure puts the old version back.
trap 'rm -rf "$tmp"; [ -n "${committed:-}" ] || git checkout -q -- "${bumped[@]}"' EXIT
node - "$version" <<'JS'
const fs = require('node:fs');
const file = 'app/package.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
manifest.version = process.argv[2];
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
JS

NOTES="${NOTES:-}" scripts/mac-release.sh "$tag"

git add "${bumped[@]}"
git commit -q -m "chore: release $tag"
committed=1
git tag "$tag"
git push -q origin main "$tag"

assets=(dist/mac/Burf-macos-universal.dmg dist/mac/Burf-macos-universal.app.tar.gz dist/mac/mac-checksums.txt)
# The release workflow may have made the release already, for its archives.
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  gh release upload "$tag" --repo "$repo" --clobber "${assets[@]}"
elif [ -n "${NOTES:-}" ]; then
  gh release create "$tag" --repo "$repo" --verify-tag --draft --title "Burf $tag" --notes "$NOTES" "${assets[@]}"
else
  gh release create "$tag" --repo "$repo" --verify-tag --draft --title "Burf $tag" --generate-notes "${assets[@]}"
fi
# Publish only after the complete app artifacts have been uploaded.
gh release edit "$tag" --repo "$repo" --draft=false --latest
echo "Published $tag. App updates remain explicit installs; the updater is disabled."
