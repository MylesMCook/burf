#!/usr/bin/env bash
# The release checks, together: what make release-check and
# scripts/publish.sh run, and what must pass before a version is tagged.
#
#   scripts/release-check.sh [--dmg PATH] [--from TAG] [--version vX.Y.Z] [--signed] [--out DIR]
#
#   1. scripts/fresh-user-test.sh   the app's first run on this Mac (macOS only)
#   2. scripts/linux-box-test.sh    a fresh Ubuntu box and laptop, in Docker
#   3. scripts/upgrade-test.sh      --from (default: the last release) to this
#                                   build, on a Linux box and on this Mac
#
# --dmg is the app to test (default: the one make app-build made last);
# --version is stamped into the Linux builds; --signed also requires the
# app to be notarized (publish.sh passes it). Off macOS only the Linux
# checks run, and it says so. Reports and screenshots go to --out (default
# dist/release-test/check-<time>/). Exit status 0 only if every check passed.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
DMG="" FROM="" VERSION=dev SIGNED="" OUT=""
while [ $# -gt 0 ]; do
	case $1 in
	--dmg) DMG=$2 && shift 2 ;;
	--from) FROM=$2 && shift 2 ;;
	--version) VERSION=$2 && shift 2 ;;
	--signed) SIGNED=--signed && shift ;;
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
if [ $mac = 1 ]; then
	run "Fresh user (macOS app)" "$here/fresh-user-test.sh" ${DMG:+--dmg "$DMG"} $SIGNED --out "$OUT/fresh-user"
fi
run "Fresh box (Linux, Docker)" "$here/linux-box-test.sh" --version "$VERSION" --out "$OUT/linux-box"
run "Upgrade (Linux box)" "$here/upgrade-test.sh" --linux ${FROM:+--from "$FROM"} --out "$OUT/upgrade-linux"
if [ $mac = 1 ]; then
	run "Upgrade (this Mac's box)" "$here/upgrade-test.sh" --mac ${FROM:+--from "$FROM"} ${DMG:+--dmg "$DMG"} --out "$OUT/upgrade-mac"
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
