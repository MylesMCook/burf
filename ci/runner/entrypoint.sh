#!/bin/bash
# The container's entrypoint (under Docker's --init).
#
#   entrypoint.sh               run every runner registered in /runner, each
#                               in a restart loop (the container's command)
#   entrypoint.sh register REPO COUNT PREFIX LABELS
#                               register COUNT runners, PREFIX-1..PREFIX-COUNT,
#                               reading the registration token from stdin
#                               (install.sh runs this once, with --rm)
#
# /runner is the named volume: /runner/<name> is one runner's copy of
# /opt/actions-runner plus its registration (.runner, .credentials*), its
# work dir (_work, with the tool cache in _work/_tool), its jobs' home (home)
# and its logs (_diag).
set -euo pipefail

# Copy the image's runner into a runner's dir when the image's version is
# new to it, keeping the registration, work dir and logs.
sync_runner() {
	local dir=$1
	mkdir -p "$dir"
	if [ "$(cat "$dir/.berth-runner-version" 2>/dev/null || true)" != "$RUNNER_VERSION" ]; then
		rsync -a --delete \
			--exclude=/.runner --exclude=/.credentials --exclude=/.credentials_rsaparams \
			--exclude=/.env --exclude=/.path --exclude=/_work --exclude=/_diag --exclude=/home \
			--exclude=/.berth-runner-version \
			/opt/actions-runner/ "$dir/"
		echo "$RUNNER_VERSION" >"$dir/.berth-runner-version"
	fi
}

register() {
	local repo=$1 count=$2 prefix=$3 labels=$4 token i name dir
	IFS= read -r token || true
	if [ -z "$token" ]; then
		echo "register: no registration token on stdin" >&2
		exit 1
	fi
	# config.sh reads --token from here: it stays out of every command line.
	export ACTIONS_RUNNER_INPUT_TOKEN=$token
	unset token
	for i in $(seq 1 "$count"); do
		name=$prefix-$i
		dir=/runner/$name
		sync_runner "$dir"
		if [ -f "$dir/.runner" ]; then
			echo "$name is already registered"
			continue
		fi
		(cd "$dir" && ./config.sh --unattended --url "https://github.com/$repo" \
			--name "$name" --labels "$labels" --work _work --replace --disableupdate)
	done
}

# One runner, restarted when it exits. Each has its own home in the volume
# (/runner/<name>/home): runners share the container, and jobs on two of them
# at once must not install pnpm, Go modules or Playwright into one directory.
run_one() {
	cd "$1"
	export HOME=$1/home
	mkdir -p "$HOME"
	while :; do
		ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/berth-runner/job-started.sh ./run.sh ||
			echo "$(basename "$1") exited ($?); restarting in 10s"
		sleep 10
	done
}

if [ "${1:-}" = register ]; then
	shift
	register "$@"
	exit 0
fi

: "${BERTH_RUNNER_REPO:?BERTH_RUNNER_REPO is not set}"
shopt -s nullglob
dirs=()
for f in /runner/*/.runner; do
	dirs+=("${f%/.runner}")
done
if [ ${#dirs[@]} -eq 0 ]; then
	echo "No runner is registered in /runner: run install.sh." >&2
	sleep 60 # restart slowly (--restart unless-stopped)
	exit 1
fi

# Job control: each runner is its own process group, and its processes do
# not start with SIGINT and SIGQUIT ignored, as a non-interactive shell's
# background jobs otherwise do. Jobs would inherit that (a `trap ... INT` in
# a test would do nothing).
set -m
pids=()
for dir in "${dirs[@]}"; do
	sync_runner "$dir"
	run_one "$dir" &
	pids+=($!)
done
stop_all() {
	local p
	for p in "${pids[@]}"; do
		kill -TERM -- "-$p" 2>/dev/null || true
	done
	wait
}
trap stop_all TERM INT
wait
