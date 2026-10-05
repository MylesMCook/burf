#!/bin/bash
# Remove the runners from GitHub, then the container, its volume and image.
#
#   DOCKER_HOST=ssh://berth-omarchy ci/runner/uninstall.sh
#
# Switch the workflows back to GitHub's runners first, or jobs wait for a
# runner that is gone: gh variable set SELF_HOSTED --body false
set -euo pipefail
# shellcheck source-path=SCRIPTDIR
. "$(dirname "$0")/common.sh"
need docker
need gh

for id in $(gh api --paginate "repos/$REPO/actions/runners" \
	--jq ".runners[] | select(.name | startswith(\"$RUNNER_PREFIX-\")) | .id"); do
	gh api -X DELETE "repos/$REPO/actions/runners/$id"
	echo "Removed runner $id from $REPO."
done

docker stop -t 30 "$CONTAINER" >/dev/null 2>&1 || true
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker volume rm "$VOLUME" >/dev/null 2>&1 || true
docker image rm "$IMAGE" >/dev/null 2>&1 || true
echo "Removed $CONTAINER, its volume $VOLUME and image $IMAGE."
