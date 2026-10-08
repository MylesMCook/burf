#!/usr/bin/env bash
# Tests scripts/merge-feed.py, which the release workflow's feed job runs to
# add the Linux app's entries to the Mac's latest.json, with made-up feeds.
#
#   scripts/release-test/feed-merge-test.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
merge="$root/scripts/merge-feed.py"
t="$(mktemp -d)"
trap 'rm -rf "$t"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
base=https://github.com/cosscom/shipyard/releases/download/v1.2.3

cat >"$t/mac.json" <<JSON
{
  "version": "1.2.3",
  "notes": "Berth 1.2.3",
  "pub_date": "2026-10-08T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {"signature": "MAC", "url": "$base/Berth-macos-universal.app.tar.gz"},
    "darwin-x86_64": {"signature": "MAC", "url": "$base/Berth-macos-universal.app.tar.gz"}
  }
}
JSON
cat >"$t/linux.json" <<JSON
{
  "version": "1.2.3",
  "platforms": {
    "linux-x86_64": {"signature": "LIN", "url": "$base/Berth-linux-x86_64-alpha.AppImage"},
    "linux-x86_64-appimage": {"signature": "LIN", "url": "$base/Berth-linux-x86_64-alpha.AppImage"}
  }
}
JSON
printf '%s\n' Berth-macos-universal.dmg Berth-macos-universal.app.tar.gz Berth-macos-universal.app.tar.gz.sig \
  Berth-linux-x86_64-alpha.AppImage Berth-linux-x86_64-alpha.AppImage.sig Berth-linux-x86_64-alpha.deb >"$t/assets"

# Merged: the Mac's feed as it was, in its order, then Linux.
"$merge" "$t/mac.json" "$t/linux.json" --assets "$t/assets" >"$t/merged.json"
python3 - "$t/merged.json" <<'PY' || fail "merged feed"
import json, sys
f = json.load(open(sys.argv[1]))
assert f["version"] == "1.2.3" and f["notes"] == "Berth 1.2.3" and f["pub_date"] == "2026-10-08T00:00:00Z", f
assert list(f["platforms"]) == ["darwin-aarch64", "darwin-x86_64", "linux-x86_64", "linux-x86_64-appimage"], list(f["platforms"])
assert f["platforms"]["darwin-aarch64"]["signature"] == "MAC"
assert f["platforms"]["linux-x86_64"]["url"].endswith("/Berth-linux-x86_64-alpha.AppImage")
PY
echo "ok: merges after the Mac's platforms"

# Again, onto the merged feed (a re-run): the same feed.
"$merge" "$t/merged.json" "$t/linux.json" --assets "$t/assets" >"$t/again.json"
cmp -s "$t/merged.json" "$t/again.json" || fail "merging twice changed the feed"
echo "ok: merging again changes nothing"

# A newer Linux build replaces its own entries only.
sed 's/"LIN"/"LIN2"/' "$t/linux.json" >"$t/linux2.json"
"$merge" "$t/merged.json" "$t/linux2.json" >"$t/replaced.json"
python3 -c 'import json,sys; f=json.load(open(sys.argv[1])); p=f["platforms"]; assert p["linux-x86_64"]["signature"]=="LIN2" and p["darwin-x86_64"]["signature"]=="MAC" and len(p)==4, p' "$t/replaced.json" ||
  fail "replacing Linux entries"
echo "ok: a re-run's Linux build replaces the Linux entries"

# refuses WHAT ARGS…: merge-feed must fail and write nothing.
refuses() {
  local what="$1"; shift
  if "$merge" "$@" >"$t/out" 2>"$t/err"; then fail "merged $what"; fi
  [ ! -s "$t/out" ] || fail "wrote a feed for $what"
  echo "ok: refuses $what ($(cat "$t/err"))"
}
sed 's/"1.2.3"/"1.2.2"/' "$t/linux.json" >"$t/old.json"
refuses "another version" "$t/mac.json" "$t/old.json"
grep -v AppImage "$t/assets" >"$t/no-appimage"
refuses "an AppImage not on the release" "$t/mac.json" "$t/linux.json" --assets "$t/no-appimage"
python3 -c 'import json,sys; f=json.load(open(sys.argv[1])); f["platforms"]["darwin-aarch64"]={"signature":"X","url":"u"}; json.dump(f,open(sys.argv[2],"w"))' "$t/linux.json" "$t/evil.json"
refuses "a fragment replacing a Mac platform" "$t/mac.json" "$t/evil.json"
echo '{"version":"1.2.3","platforms":{}}' >"$t/empty.json"
refuses "an empty fragment" "$t/mac.json" "$t/empty.json"
echo "feed-merge: all passed"
