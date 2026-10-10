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
# interface folder is main's. Nothing unmerged or uncommitted is touched,
# and one removal that git refuses does not stop the rest: it is listed
# under "skipped" with the reason.
#
#   scripts/tidy.sh            do it
#   scripts/tidy.sh --dry-run  say what it would do
set -eu
cd "$(dirname "$0")/.."
dry=0
[ "${1:-}" != "--dry-run" ] || dry=1
notes="$(mktemp)"
trap 'rm -f "$notes"' EXIT
# try makes one removal. A refusal (a locked worktree, a branch a worktree
# still holds) is noted with git's own reason and the run goes on.
try() {
	if [ "$dry" = 1 ]; then
		echo "would: $*"
	elif ! out="$("$@" 2>&1)"; then
		echo "$* ($(printf '%s' "$out" | tail -1))" >> "$notes"
	fi
}
in_main() { git merge-base --is-ancestor "$1" origin/main 2> /dev/null; }

git fetch -q --prune origin
here="$(git branch --show-current)"
# As git names it, which is not $PWD when a folder on the way is a link.
top="$(git rev-parse --show-toplevel)"

# Worktrees first: a branch checked out in one cannot be deleted.
git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r wt; do
	[ "$wt" != "$top" ] || continue
	if [ -z "$(git -C "$wt" status --porcelain 2> /dev/null)" ] && in_main "$(git -C "$wt" rev-parse HEAD)"; then
		try git worktree remove "$wt"
	fi
done
[ "$dry" = 1 ] || git worktree prune

for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
	case "$b" in main | trunk | "$here") continue ;; esac
	if in_main "$b"; then try git branch -q -D "$b"; fi
done

gone=""
for r in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do
	b="${r#origin/}"
	case "$b" in main | HEAD | origin) continue ;; esac
	if in_main "$r"; then gone="$gone $b"; fi
done
# shellcheck disable=SC2086 # the branch names are separate words
[ -z "$gone" ] || try git push -q origin --delete $gone

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
# The same interface is the same source, whatever commit it was built at:
# only what the bundle is made from counts, not Go, docs or tests.
burf="$(command -v burf || true)"
have=""
[ -z "$burf" ] || have="$("$burf" ui status 2> /dev/null | sed -n 's/^Version: .*+//p')"
if [ -z "$have" ]; then
	echo "none installed: scripts/ship-ui.sh"
elif ! git cat-file -e "$have^{commit}" 2> /dev/null; then
	echo "built at $have, which this checkout does not have: scripts/ship-ui.sh"
elif git diff --quiet "$have" origin/main -- app ':(exclude)app/e2e' ':(exclude)app/native' ':(exclude)app/playwright.config.ts' ':(exclude,glob)app/**/*.test.ts'; then
	echo "main's (built at $have; the interface has not changed since)"
else
	echo "behind main (built at $have): scripts/ship-ui.sh"
fi

if [ -s "$notes" ]; then
	echo "== skipped"
	cat "$notes"
fi
