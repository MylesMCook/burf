#!/bin/sh
# Install berthd on a box that calport already reaches, without SSH: calport
# runs a one-shot upload receiver on the box, the daemon goes up through
# calport's private URL for it, and berthd installs and prints a pairing link
# that this laptop's berth then uses.
#
#   scripts/install-via-calport.sh BOX LOCATION [--network NET]
#
# LOCATION is any calport location on the box; commands run there.
set -eu

box=${1:?usage: install-via-calport.sh BOX LOCATION [--network NET]}
loc=${2:?usage: install-via-calport.sh BOX LOCATION [--network NET]}
shift 2
network_flag=""
if [ "${1:-}" = "--network" ]; then
	network_flag="--network ${2:?--network needs a name}"
fi

here=$(cd "$(dirname "$0")/.." && pwd)
berth="$here/bin/berth"
port=17444
proxy_port=$(calport status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["proxy"]["port"])')

arch=$(calport info "$box" | python3 -c 'import json,sys; print(json.load(sys.stdin)["arch"])')
daemon="$here/bin/berthd-linux-$arch"
[ -f "$daemon" ] || { echo "no $daemon; run make all" >&2; exit 1; }

# The receiver writes the upload over ~/.local/bin/berthd and exits.
receiver=$(cat <<'PY'
import http.server, os, sys
class H(http.server.BaseHTTPRequestHandler):
    def do_PUT(self):
        n = int(self.headers["Content-Length"])
        d = os.path.expanduser("~/.local/bin")
        os.makedirs(d, exist_ok=True)
        tmp = os.path.join(d, "berthd.new")
        with open(tmp, "wb") as f:
            left = n
            while left:
                b = self.rfile.read(min(left, 1 << 20))
                if not b: break
                f.write(b); left -= len(b)
        os.chmod(tmp, 0o755)
        os.replace(tmp, os.path.join(d, "berthd"))
        self.send_response(200); self.end_headers(); self.wfile.write(b"ok\n")
        sys.exit(0)
    def log_message(self, *a): pass
http.server.HTTPServer(("127.0.0.1", int(sys.argv[1])), H).handle_request()
PY
)

echo "Starting an upload receiver on ${box}…"
# calport joins the command's words with spaces, so the script travels as
# base64 rather than through a second layer of quoting.
b64=$(printf '%s' "$receiver" | base64 | tr -d '\n')
calport session new "$box/$loc" --name berth-upload -- "python3 -c \"import base64; exec(base64.b64decode('$b64'))\" $port" >/dev/null
trap 'calport session kill "$box/berth-upload" >/dev/null 2>&1 || true' EXIT
# Wait for it to listen without connecting: it serves exactly one request.
for _ in $(seq 1 15); do
	calport ports "$box" --json | grep -Eq "\"port\": *$port[^0-9]" && break
	sleep 1
done

echo "Uploading $(basename "$daemon")…"
curl -fsS -T "$daemon" "http://$port.$box.localhost:$proxy_port/berthd"

echo "Installing berthd…"
calport session new "$box/$loc" --name berth-install -- '~/.local/bin/berthd install && sleep 1 && ~/.local/bin/berthd pair; sleep 600' >/dev/null
link=""
for _ in $(seq 1 20); do
	sleep 1
	# The quoted copy of the link survives tmux wrapping it across lines.
	link=$(calport session screen "$box/berth-install" | tr -d '\n' | grep -o "berth pair '[^']*'" | head -1 | sed "s/^berth pair '//; s/'\$//" || true)
	[ -n "$link" ] && break
done
calport session kill "$box/berth-install" >/dev/null 2>&1 || true
[ -n "$link" ] || { echo "berthd did not print a pairing link" >&2; exit 1; }

# shellcheck disable=SC2086
"$berth" pair "$link" --name "$box" $network_flag
