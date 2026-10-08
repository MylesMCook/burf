# shellcheck shell=bash
# The Linux half of the release tests: a fresh Ubuntu 24.04 box (systemd as
# init, so berthd is the systemd user service it is on a real box) and a
# fresh laptop, in Docker, on a network of their own. Nothing on the host is
# touched: the laptop's agent and proxy listen inside its container. Sourced
# by scripts/linux-box-test.sh and scripts/upgrade-test.sh after common.sh.

LINUX_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
RT_DIR=$(dirname "$LINUX_DIR")
REPO=$(cd "$RT_DIR/../.." && pwd)
IMAGE=berth-release-test:ubuntu24

# docker_arch: the containers' Go architecture.
docker_arch() {
	case $(docker info --format '{{.Architecture}}' 2>/dev/null) in
	x86_64 | amd64) echo amd64 ;;
	aarch64 | arm64) echo arm64 ;;
	*) return 1 ;;
	esac
}

# build_dist DIR VERSION: the archives a release carries, for the
# containers' architecture, as scripts/build-release.sh makes them (that
# script empties dist/, so the test builds its own), with checksums.txt and
# this checkout's install.sh beside them.
build_dist() {
	local dir=$1 version=$2 arch
	arch=$(docker_arch) || return 1
	mkdir -p "$dir/stage/berthd" "$dir/stage/berth"
	local ld="-s -w -X github.com/cosscom/shipyard/internal/version.Version=$version"
	(cd "$REPO" && CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -trimpath -ldflags "$ld" -o "$dir/stage/berthd/berthd" ./cmd/berthd) || return 1
	(cd "$REPO" && CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -trimpath -ldflags "$ld" -o "$dir/stage/berth/berth" ./cmd/berth) || return 1
	cp "$dir/stage/berthd/berthd" "$dir/stage/berth/berthd-linux-$arch"
	# As build-release.sh: macOS's tar would add extended attributes.
	local flags=()
	tar --version 2>/dev/null | grep -q bsdtar && flags=(--no-mac-metadata --no-xattrs)
	tar "${flags[@]}" -czf "$dir/berthd-linux-$arch.tar.gz" -C "$dir/stage/berthd" berthd || return 1
	tar "${flags[@]}" -czf "$dir/berth-linux-$arch.tar.gz" -C "$dir/stage/berth" berth "berthd-linux-$arch" || return 1
	rm -rf "$dir/stage"
	(cd "$dir" && shasum -a 256 ./*.tar.gz | sed 's|  \./|  |' >checksums.txt) || return 1
	cp "$REPO/site/install.sh" "$dir/install.sh"
}

# use_dist DIR: release archives already built (make release), with this
# checkout's install.sh.
use_dist() {
	local src=$1 dir=$2 arch
	arch=$(docker_arch) || return 1
	mkdir -p "$dir"
	for f in "berthd-linux-$arch.tar.gz" "berth-linux-$arch.tar.gz" checksums.txt; do
		cp "$src/$f" "$dir/$f" || return 1
	done
	cp "$REPO/site/install.sh" "$dir/install.sh"
}

# download_dist TAG DIR: a release's archives, with this checkout's
# install.sh (the one berthd.app/install serves from main).
download_dist() {
	local tag=$1 dir=$2 arch
	arch=$(docker_arch) || return 1
	mkdir -p "$dir"
	gh release download "$tag" --repo cosscom/shipyard --dir "$dir" --clobber \
		--pattern "berthd-linux-$arch.tar.gz" --pattern "berth-linux-$arch.tar.gz" --pattern checksums.txt || return 1
	cp "$REPO/site/install.sh" "$dir/install.sh"
}

build_image() {
	docker build -q -t "$IMAGE" -f "$LINUX_DIR/Dockerfile" "$RT_DIR" >/dev/null
}

# start_machines NAME DIST: a box (BOXC) and a laptop (LAPC) container, on
# their own network, the box serving DIST on :8000 to install.sh.
start_machines() {
	local name=$1 dist=$2
	NET="$name-net" BOXC="$name-box" LAPC="$name-laptop"
	docker network create "$NET" >/dev/null || return 1
	docker run -d --name "$BOXC" --hostname "${BOX_HOSTNAME:-ubuntu-box}" --network "$NET" \
		--privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw --tmpfs /run --tmpfs /run/lock \
		-v "$dist:/dist:ro" "$IMAGE" >/dev/null || return 1
	docker run -d --name "$LAPC" --hostname laptop --network "$NET" "$IMAGE" sleep infinity >/dev/null || return 1
	until_ok 60 sh -c "docker exec '$BOXC' systemctl is-system-running 2>/dev/null | grep -q -E 'running|degraded'" || {
		echo "systemd did not come up in the box" >&2
		return 1
	}
	until_ok 30 docker exec "$BOXC" test -d /run/user/1000 || {
		echo "dev's systemd user session did not start (lingering)" >&2
		return 1
	}
	docker exec -d "$BOXC" python3 -m http.server 8000 --directory /dist --bind 0.0.0.0 || return 1
	until_ok 20 docker exec "$BOXC" curl -fsS -o /dev/null http://127.0.0.1:8000/
}

# bx / lp COMMAND: a login shell as dev on the box (as SSH gives one) or
# the laptop.
bx() { docker exec -u dev -e XDG_RUNTIME_DIR=/run/user/1000 -w /home/dev "$BOXC" bash -lc "$*"; }
lp() { docker exec -u dev -w /home/dev "$LAPC" bash -lc "$*"; }

# box_install [ARGS…]: the install command, as a person pastes it, but from
# the test's archives (BERTH_DOWNLOAD_BASE). Sets PAIR_LINK.
box_install() {
	local out
	out=$(bx "curl -fsSL http://127.0.0.1:8000/install.sh | BERTH_DOWNLOAD_BASE=http://127.0.0.1:8000 sh -s -- --listen 0.0.0.0:7444 --yes $*" 2>&1)
	local rc=$?
	echo "$out"
	[ $rc = 0 ] || return 1
	PAIR_LINK=$(echo "$out" | sed -n "s/.*\(berth:\/\/[^ '\"]*\).*/\1/p" | head -1)
	[ -n "$PAIR_LINK" ]
}

# laptop_cli: berth on the laptop, as "the CLI without the app" installs it.
laptop_cli() {
	local arch
	arch=$(docker_arch) || return 1
	lp "set -e; mkdir -p ~/.local/bin; cd /tmp; curl -fsSL -O http://$BOXC:8000/berth-linux-$arch.tar.gz -O http://$BOXC:8000/checksums.txt
		grep ' berth-linux-$arch.tar.gz\$' checksums.txt | sha256sum -c -
		tar -xzf berth-linux-$arch.tar.gz -C ~/.local/bin berth"
}

# laptop_api METHOD PATH [JSON]: the laptop agent's app API.
laptop_api() {
	lp "tok=\$(berth ui-token | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"token\"])'); curl -sS --max-time 60 -X $1 -H \"Authorization: Bearer \$tok\" -H 'Content-Type: application/json' ${3:+--data '$3'} http://127.0.0.1:1378$2"
}

linux_cleanup() {
	set +e
	[ -n "${BOXC:-}" ] || return 0
	if [ "${KEEP:-0}" = 1 ]; then
		say "Kept the containers $BOXC and $LAPC (--keep); remove them with: docker rm -f $BOXC $LAPC && docker network rm $NET"
		return 0
	fi
	docker rm -f "$BOXC" "$LAPC" >/dev/null 2>&1
	docker network rm "$NET" >/dev/null 2>&1
	return 0
}
