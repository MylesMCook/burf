#!/bin/sh
# check-local.sh is the check before a push. It is meant to finish in under a
# minute, so it runs only what the change reaches:
#
#   the app changed   type-check (kept warm between runs), the Node unit
#                     tests, and the browser spec files scripts/e2e-pick.mjs
#                     names for the changed paths, against a two-second
#                     bundle. Never the whole browser suite: that runs on the
#                     hosted runner after a merge.
#   Go changed        go vet and the tests of the packages that changed.
#   scripts changed   their own node tests, and shellcheck when installed.
#
#   scripts/check-local.sh           what differs from origin/main, committed or not
#   scripts/check-local.sh --smoke   the app's checks with the smoke specs
#
# To look at a change while making it, use the dev server instead: no build
# at all (E2E_DEV=1 with a spec, or pnpm dev). The browser specs use their
# fixtures only.
set -eu
cd "$(dirname "$0")/.."
unset BERTH_E2E_LIVE
PORT="${E2E_PORT:-1434}"
T0="$(date +%s)"

base="$(git merge-base origin/main HEAD 2>/dev/null || git rev-parse HEAD)"
changed="$({ git diff --name-only "$base"; git ls-files --others --exclude-standard; } | sort -u)"
if [ "${1:-}" = "--smoke" ]; then
	changed="app/e2e/fixtures.ts"
fi
has() { printf '%s\n' "$changed" | grep -q "$1"; }
fail=0

if has '^app/'; then
	specs="$(printf '%s\n' "$changed" | node scripts/e2e-pick.mjs | tr '\n' ' ')"
	(
		cd app
		mkdir -p node_modules/.cache
		# The type-check and the unit tests run beside the browser specs.
		(pnpm exec tsc --noEmit -p . && pnpm exec tsc --noEmit -p e2e) > node_modules/.cache/check-tsc.log 2>&1 &
		tsc=$!
		pnpm test > node_modules/.cache/check-unit.log 2>&1 &
		unit=$!
		e2e=0
		if [ -n "$specs" ]; then
			# The specs run against a fresh bundle, not the dev server: bundling
			# takes two seconds, and a bundled page loads in a sixth of the
			# requests, which is what the specs spend their time on. No
			# type-check is in it (that runs beside it, above).
			pnpm exec vite build --logLevel error > node_modules/.cache/check-vite.log 2>&1 || { echo "BUNDLE FAILED"; tail -20 node_modules/.cache/check-vite.log; exit 1; }
			# shellcheck disable=SC2086 # the spec names are separate words
			E2E_PORT="$PORT" pnpm exec playwright test $specs --reporter=dot || e2e=1
		else
			echo "browser specs: none for these paths"
		fi
		wait "$tsc" || { echo "TYPE-CHECK FAILED"; cat node_modules/.cache/check-tsc.log; e2e=1; }
		wait "$unit" || { echo "UNIT TESTS FAILED"; grep -E "^not ok|^# (pass|fail)|✖" node_modules/.cache/check-unit.log | head -40; e2e=1; }
		exit "$e2e"
	) || fail=1
	echo "app: type-check, unit tests, specs: ${specs:-none}"
fi

if has '\.go$'; then
	pkgs="$(printf '%s\n' "$changed" | grep '\.go$' | xargs -n1 dirname | sort -u | while read -r d; do if [ -d "$d" ]; then printf './%s ' "$d"; fi; done)"
	if [ -n "$pkgs" ]; then
		# shellcheck disable=SC2086 # the package paths are separate words
		{ go vet $pkgs && go test $pkgs; } || fail=1
		echo "go: vet and tests of $pkgs"
	fi
fi

if has '^scripts/.*\.mjs$'; then
	node --test scripts/*.test.mjs > /dev/null 2>&1 || { echo "SCRIPT TESTS FAILED"; node --test scripts/*.test.mjs 2>&1 | grep -E "^not ok|✖" | head; fail=1; }
	echo "scripts: node tests"
fi
if has '\.sh$' && command -v shellcheck > /dev/null; then
	shellcheck scripts/check-local.sh || fail=1
fi

echo "check-local: $(($(date +%s) - T0)) s$([ "$fail" = 0 ] && echo ", passed" || echo ", FAILED")"
exit "$fail"
