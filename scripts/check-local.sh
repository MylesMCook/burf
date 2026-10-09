#!/bin/sh
# check-local.sh runs, on this machine, the checks a change needs before it
# is pushed: the suites scripts/ci-changes.mjs picks for what differs from
# main, by the commands CI runs for them. The browser suite belongs here: a
# pull request's hosted run leaves it out, and main runs it once per merge
# (.github/workflows/ci.yml).
#
#   scripts/check-local.sh           what differs from origin/main, committed or not
#   scripts/check-local.sh --all     every suite this machine can run
#   scripts/check-local.sh e2e app   the named suites
#
# The browser suite uses its fixtures only. Building both desktops, native
# Windows and the docs site stay with the hosted run.
set -eu
cd "$(dirname "$0")/.."
unset BERTH_E2E_LIVE

case "${1:-}" in
"")
	base="$(git merge-base origin/main HEAD)"
	suites="$({ git diff --name-only "$base"; git ls-files --others --exclude-standard; } | node scripts/ci-changes.mjs | sed -n 's/=true$//p')"
	;;
--all) suites="$(node scripts/ci-changes.mjs --all | sed -n 's/=true$//p')" ;;
*) suites="$*" ;;
esac

ran=""
for suite in $suites; do
	case "$suite" in
	go)
		go vet ./...
		GORACE=atexit_sleep_ms=0 go test -race ./...
		;;
	app)
		(
			cd app
			pnpm install --frozen-lockfile
			pnpm typecheck:plugins
			pnpm check:titles
			pnpm check:csp
			pnpm check:themes
			pnpm test
			pnpm test:platform
			pnpm build
			pnpm exec tsc --noEmit -p e2e
		)
		node --test scripts/ci-changes.test.mjs scripts/windows-installer-template.test.mjs scripts/windows-packaging.test.mjs
		;;
	e2e)
		(
			cd app
			pnpm install --frozen-lockfile
			pnpm build
			pnpm exec playwright test --workers="${E2E_WORKERS:-2}"
		)
		;;
	shell)
		if command -v shellcheck >/dev/null; then
			shellcheck scripts/check-local.sh site/install.sh scripts/build-release.sh scripts/build-tmux.sh scripts/publish.sh scripts/mac-release.sh
		else
			echo "shell: shellcheck is not installed here; the hosted run checks it"
			continue
		fi
		;;
	desktop | windows | docs)
		echo "$suite: left to the hosted run"
		continue
		;;
	*)
		echo "unknown suite: $suite" >&2
		exit 2
		;;
	esac
	ran="$ran $suite"
done
echo "passed here:${ran:- nothing to run}"
