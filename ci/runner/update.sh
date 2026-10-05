#!/bin/bash
# Rebuild the image (a new RUNNER_VERSION in the Dockerfile, newer Ubuntu
# packages, gh and Chrome) and recreate the container on it. The volume keeps
# the registrations and work dirs, so no token is needed. A running job is
# cancelled: run it when CI is idle.
#
#   DOCKER_HOST=ssh://berth-omarchy ci/runner/update.sh
set -euo pipefail
. "$(dirname "$0")/common.sh"
need docker

docker container inspect "$CONTAINER" >/dev/null 2>&1 || die "$CONTAINER does not exist: run install.sh"
old=$(docker image inspect -f '{{.Id}}' "$IMAGE" 2>/dev/null || true)
build_image
new=$(docker image inspect -f '{{.Id}}' "$IMAGE")

docker rm -f "$CONTAINER" >/dev/null
start_container
if [ -n "$old" ] && [ "$old" != "$new" ]; then
	docker image rm "$old" >/dev/null 2>&1 || true
fi
