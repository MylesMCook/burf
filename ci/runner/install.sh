#!/bin/bash
# Build the runner image, register the runners and start the container.
#
#   DOCKER_HOST=ssh://berth-omarchy ci/runner/install.sh
#
# The registration token comes from `gh api` (repository admin), or, where
# gh is not installed, from stdin. It goes to a one-off container on its
# stdin and is never written down, put on a command line or printed.
set -euo pipefail
. "$(dirname "$0")/common.sh"
need docker

if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
	die "$CONTAINER already exists: update.sh rebuilds it, uninstall.sh removes it"
fi

build_image

if command -v gh >/dev/null 2>&1; then
	token=$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq .token)
else
	IFS= read -r token || true
fi
[ -n "$token" ] || die "no registration token"

docker volume create "$VOLUME" >/dev/null
printf '%s\n' "$token" | docker run --rm -i \
	--mount "type=volume,src=$VOLUME,dst=/runner" \
	"$IMAGE" register "$REPO" "$RUNNERS" "$RUNNER_PREFIX" "$RUNNER_LABELS"
unset token

start_container
echo "Runners: https://github.com/$REPO/settings/actions/runners"
