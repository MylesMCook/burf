#!/usr/bin/env bash
# The release checks, together: what make release-check and
# scripts/publish.sh run, and what must pass before a version is tagged.
#
#   scripts/release-check.sh [--dmg PATH] [--from TAG] [--version vX.Y.Z] [--signed] [--out DIR]
#                            [--no-build] [--universal] [--any-build]
#
#   1. scripts/fresh-user-test.sh   the app's first run on this Mac (macOS only)
#   2. scripts/linux-box-test.sh    a fresh Ubuntu box and laptop, in Docker
#   3. scripts/upgrade-test.sh      --from (default: the last release) to this
#                                   build, on a Linux box and on this Mac
#
# --dmg is the app to test. Without it, on a Mac, the app is built from HEAD
# first with make app-build (--universal: both architectures, as the release
# workflow builds it; --no-build: use a dmg already built from HEAD), so the
# gate always tests what would be tagged. Every test refuses a dmg built
# from another commit, or without berthd, unless --any-build;
# --version is stamped into the Linux builds; --signed also requires the
# app to be notarized (publish.sh passes it). Off macOS only the Linux
# checks run, and it says so. Reports and screenshots go to --out (default
# dist/release-test/check-<time>/). Exit status 0 only if every check passed.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
DMG="" FROM="" VERSION=dev SIGNED="" OUT="" BUILD=1 UNIVERSAL="" ANY=""
while [ $# -gt 0 ]; do
	case $1 in
	--dmg) DMG=$2 && shift 2 ;;
	--from) FROM=$2 && shift 2 ;;
	--version) VERSION=$2 && shift 2 ;;
	--signed) SIGNED=--signed && shift ;;
	--no-build) BUILD=0 && shift ;;
	--universal) UNIVERSAL=1 && shift ;;
	--any-build) ANY=--any-build && shift ;;
	--out) OUT=$2 && shift 2 ;;
	-h | --help) sed -n '2,/^set -euo/p' "$0" | sed -e '$d' -e 's/^# \{0,1\}//' && exit 0 ;;
	*) echo "unknown option $1 (try --help)" >&2 && exit 2 ;;
	esac
done
OUT=${OUT:-$(cd "$here/.." && pwd)/dist/release-test/check-$(date +%Y%m%d-%H%M%S)}
mkdir -p "$OUT"

results=()
run() { # run NAME COMMAND…
	local name=$1
	shift
	echo
	echo "=== $name"
	if "$@"; then results+=("pass  $name"); else results+=("FAIL  $name"); fi
}

mac=0
[ "$(uname -s)" = Darwin ] && mac=1
if [ $mac = 1 ] && [ -z "$DMG" ]; then
	# shellcheck source=release-test/common.sh
	source "$here/release-test/common.sh"
	# shellcheck source=release-test/macos/lib.sh
	source "$here/release-test/macos/lib.sh"
	if [ "$BUILD" = 1 ]; then
		echo "=== Building the app from HEAD ($(git -C "$here/.." rev-parse --short HEAD)), as a release is: make app-build${UNIVERSAL:+ APP_TARGET=universal-apple-darwin} (log: $OUT/app-build.log)"
		if ! make -C "$here/.." app-build ${UNIVERSAL:+APP_TARGET=universal-apple-darwin} >"$OUT/app-build.log" 2>&1; then
			tail -20 "$OUT/app-build.log"
			echo "release-check: building the app failed (see $OUT/app-build.log)" >&2
			exit 1
		fi
	fi
	DMG=$(find_dmg) || {
		echo "release-check: no dmg built from HEAD to test; build one with make app-build, or pass DMG=path (make) / --dmg PATH" >&2
		exit 1
	}
	echo "Testing $DMG"
fi
if [ $mac = 1 ]; then
	run "Fresh user (macOS app)" "$here/fresh-user-test.sh" --dmg "$DMG" $SIGNED $ANY --out "$OUT/fresh-user"
fi
run "Fresh box (Linux, Docker)" "$here/linux-box-test.sh" --version "$VERSION" --out "$OUT/linux-box"
run "Upgrade (Linux box)" "$here/upgrade-test.sh" --linux ${FROM:+--from "$FROM"} --out "$OUT/upgrade-linux"
if [ $mac = 1 ]; then
	run "Upgrade (this Mac's box)" "$here/upgrade-test.sh" --mac ${FROM:+--from "$FROM"} --dmg "$DMG" $ANY --out "$OUT/upgrade-mac"
fi

echo
echo "Release checks (reports in $OUT):"
failed=0
for r in "${results[@]}"; do
	echo "  $r"
	case $r in FAIL*) failed=1 ;; esac
done
if [ $mac = 0 ]; then
	echo "  (the macOS checks need a Mac: run make release-check there before tagging)"
fi
exit $failed
