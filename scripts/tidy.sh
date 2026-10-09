#!/bin/sh
# tidy.sh puts the repository back in order after work lands, and says what
# is still open. It only removes what is already safe to lose:
#
#   branches      here and on origin, whose tip is in origin/main
#   worktrees     registered here, with nothing uncommitted and a tip in main
#   worker clones under $BURF_CLONES (default ~/.codex/worktrees/*/burf) are
#                 only reported: clean and merged ones are named as free
#
# Then it lists what is left: open pull requests, branches that are not in
# main, checkouts with uncommitted work, and whether this computer's
# interface folder is main's. Nothing unmerged or uncommitted is touched.
#
#   scripts/tidy.sh            do it
#   scripts/tidy.sh --dry-run  say what it would do
set -eu
cd "$(dirname "$0")/.."
dry=0
[ "${1:-}" != "--dry-run" ] || dry=1
run() { if [ "$dry" = 1 ]; then echo "would: $*"; else "$@"; fi; }
in_main() { git merge-base --is-ancestor "$1" origin/main 2> /dev/null; }

git fetch -q --prune origin
here="$(git branch --show-current)"

# Worktrees first: a branch checked out in one cannot be deleted.
git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r wt; do
	[ "$wt" != "$PWD" ] || continue
	if [ -z "$(git -C "$wt" status --porcelain 2> /dev/null)" ] && in_main "$(git -C "$wt" rev-parse HEAD)"; then
		run git worktree remove "$wt"
	fi
done
[ "$dry" = 1 ] || git worktree prune

for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
	case "$b" in main | trunk | "$here") continue ;; esac
	if in_main "$b"; then run git branch -q -D "$b"; fi
done

gone=""
for r in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do
	b="${r#origin/}"
	case "$b" in main | HEAD | origin) continue ;; esac
	if in_main "$r"; then gone="$gone $b"; fi
done
# shellcheck disable=SC2086 # the branch names are separate words
[ -z "$gone" ] || run git push -q origin --delete $gone

echo "== open pull requests"
# origin's, not the upstream this fork came from.
repo="$(git remote get-url origin | sed -e 's#.*github.com[:/]##' -e 's#\.git$##')"
gh pr list -R "$repo" --state open --json number,headRefName,title -q '.[] | "#\(.number) \(.headRefName): \(.title)"' 2> /dev/null || echo "(gh could not list them)"

echo "== branches not in main"
for r in $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes/origin); do
	case "$r" in main | trunk | origin/main | origin/HEAD | origin) continue ;; esac
	in_main "$r" || echo "$r ($(git rev-list --count origin/main.."$r") ahead, $(git log -1 --format=%cd --date=short "$r"))"
done

echo "== checkouts"
# shellcheck disable=SC2046,SC2086 # one checkout per word, and the pattern is meant to expand
for d in $(printf '%s\n' $(git worktree list --porcelain | sed -n 's/^worktree //p') ${BURF_CLONES:-"$HOME"/.codex/worktrees/*/burf} | sort -u); do
	[ -e "$d/.git" ] || continue
	dirty="$(git -C "$d" status --porcelain | wc -l | tr -d ' ')"
	stash="$(git -C "$d" stash list | wc -l | tr -d ' ')"
	state="$dirty uncommitted, $stash stashed, not in main"
	if [ "$dirty" = 0 ] && [ "$stash" = 0 ] && in_main "$(git -C "$d" rev-parse HEAD)"; then state="free"; fi
	echo "$d [$(git -C "$d" branch --show-current)]: $state"
done

echo "== interface on this computer"
burf="$(command -v burf || true)"
main="$(git rev-parse --short=12 origin/main)"
if [ -n "$burf" ] && "$burf" ui status 2> /dev/null | grep -q "+$main"; then
	echo "main's ($main)"
else
	echo "not main's ($main): scripts/ship-ui.sh"
fi
