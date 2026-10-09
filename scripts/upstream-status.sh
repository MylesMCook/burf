#!/bin/sh
set -eu

case "${1-}" in
  '') ;;
  --fetch) ;;
  *) printf '%s\n' 'Usage: sh scripts/upstream-status.sh [--fetch]' >&2; exit 2 ;;
esac
if [ "$#" -gt 1 ]; then
  printf '%s\n' 'Usage: sh scripts/upstream-status.sh [--fetch]' >&2
  exit 2
fi

root=$(git rev-parse --show-toplevel)
cd "$root"
if [ "${1-}" = --fetch ]; then
  git fetch upstream
fi
if ! git rev-parse --verify refs/remotes/upstream/main >/dev/null 2>&1; then
  printf '%s\n' 'No upstream/main reference. Configure upstream, then run with --fetch.' >&2
  exit 1
fi

printf '%s\n' 'Burf upstream status (local references; no merge or deployment)'
printf 'Local:    '; git log -1 --format='%h %s' HEAD
printf 'Upstream: '; git log -1 --format='%h %s' upstream/main
printf 'Base:     '; git merge-base HEAD upstream/main
printf 'Fork-only commits: '; git rev-list --count upstream/main..HEAD
printf 'Upstream-only commits: '; git rev-list --count HEAD..upstream/main
printf 'Upstream-only non-merge commits: '; git rev-list --count --no-merges HEAD..upstream/main
printf '\n%s\n' 'Uncommitted files (not included in commit counts):'
git status --short
printf '\n%s\n' 'Recent upstream changes not merged (up to 30):'
git log --no-merges --max-count=30 --format='%h %ad %s' --date=short HEAD..upstream/main
printf '\n%s\n' 'See UPSTREAM.md for intake priorities, compatibility rules and verification.'
