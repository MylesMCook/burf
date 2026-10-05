# Shared by install.sh, update.sh and uninstall.sh. Every setting can be
# overridden from the environment; docker talks to $DOCKER_HOST, e.g.
# DOCKER_HOST=ssh://berth-omarchy to run these from the laptop.
# shellcheck shell=bash

REPO=${REPO:-sean-brydon/berthd}
RUNNER_PREFIX=${RUNNER_PREFIX:-omarchy}  # runners are omarchy-1..omarchy-$RUNNERS
RUNNERS=${RUNNERS:-4}                    # jobs at once (install time only)
RUNNER_LABELS=${RUNNER_LABELS:-omarchy}  # plus self-hosted, Linux, X64
IMAGE=${IMAGE:-berth-runner:latest}
CONTAINER=${CONTAINER:-berth-runner}
VOLUME=${VOLUME:-berth-runner}
MEMORY=${MEMORY:-12g}
CPUS=${CPUS:-12}

here=$(cd "$(dirname "$0")" && pwd)

die() {
	echo "$(basename "$0"): $*" >&2
	exit 1
}

need() {
	command -v "$1" >/dev/null 2>&1 || die "$1 is not installed"
}

build_image() {
	docker build --pull -t "$IMAGE" "$here"
}

# The long-running container: the named volume is its only mount; no Docker
# socket, no --privileged, no host network; capped memory, CPUs and PIDs.
start_container() {
	docker run -d --name "$CONTAINER" --hostname "$CONTAINER" \
		--init --restart unless-stopped \
		--memory "$MEMORY" --memory-swap "$MEMORY" --cpus "$CPUS" \
		--pids-limit 16384 --shm-size 2g --cap-drop NET_RAW \
		--log-opt max-size=10m --log-opt max-file=3 \
		--mount "type=volume,src=$VOLUME,dst=/runner" \
		-e BERTH_RUNNER_REPO="$REPO" \
		"$IMAGE" >/dev/null
	echo "Started $CONTAINER ($IMAGE, $CPUS CPUs, $MEMORY)."
}
