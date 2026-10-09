#!/bin/sh
# ship-ui.sh releases the interface: it bundles the frontend, writes its
# manifest, and installs it in the interface folder of this computer and of
# each other one named, with no native build (FORK.md, "The interface
# folder"). A window draws it at its next launch, or from Settings, About,
# Reload interface. This is the default way to ship a frontend change; a
# native build is only for a change to the shell itself (a new
# internal/uicontract/shell.txt value).
#
#   scripts/ship-ui.sh                    this computer only
#   scripts/ship-ui.sh work-hp mc-pc      and these, over ssh
#   BURF_SHIP_HOSTS="work-hp mc-pc" scripts/ship-ui.sh
#
# A host is an ssh name. On it the burf command is looked for on PATH, then
# where the Windows preview keeps it. A host that refuses the interface is
# named and the script fails. `burf ui rollback` on a machine puts the
# previous interface back.
set -eu
cd "$(dirname "$0")/.."
T0="$(date +%s)"
hosts="${*:-${BURF_SHIP_HOSTS:-}}"
failed=0

(cd app && pnpm exec vite build --logLevel error)
node scripts/ui-manifest.mjs app/dist
version="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("app/dist/manifest.json","utf8")).version)')"
echo "built $version in $(($(date +%s) - T0)) s"

burf="$(command -v burf || true)"
[ -n "$burf" ] || burf=/Applications/Burf.app/Contents/MacOS/burf-cli
"$burf" ui install app/dist
"$burf" ui status

if [ -n "$hosts" ]; then
	work="$(mktemp -d)"
	zip="$work/burf-ui.zip"
	(cd app/dist && zip -qr "$zip" .)
	# What a Windows host runs. The CLI is on PATH or in the preview's folder.
	cat > "$work/install.ps1" <<'PS'
$cli = (Get-Command burf -ErrorAction SilentlyContinue).Source
if (!$cli) { $cli = Join-Path $env:LOCALAPPDATA 'BerthLocalPreview\cli\burf.exe' }
$zip = Join-Path $HOME 'burf-ui.zip'
& $cli ui install $zip
& $cli ui status
Remove-Item $zip -Force
PS
	# A host has it only when its own status names this version, whole and
	# compatible: neither shell's exit status is proof of that.
	has_it() { grep -q "Version: $version" "$1" && grep -q "Whole: true; compatible: true" "$1"; }
	for host in $hosts; do
		(
			# A Windows host runs the PowerShell lines; any other runs burf itself.
			log="$work/$host.log"
			scp -q -o ConnectTimeout=10 "$zip" "$host:burf-ui.zip" > "$log" 2>&1 || true
			ssh -o ConnectTimeout=10 "$host" 'powershell -NoProfile -Command -' < "$work/install.ps1" >> "$log" 2>&1 || true
			has_it "$log" ||
				ssh -o ConnectTimeout=10 "$host" 'burf ui install burf-ui.zip; burf ui status; rm -f burf-ui.zip' >> "$log" 2>&1 || true
			if has_it "$log"; then
				echo "$host: installed"
			else
				echo "$host: FAILED"
				tr -d '\r' < "$log" | grep -v '^ *$' | tail -5 | sed 's/^/  /'
				touch "$work/failed"
			fi
		) &
	done
	wait
	[ ! -e "$work/failed" ] || failed=1
fi

if [ "$failed" = 1 ]; then
	echo "NOT shipped everywhere ($version, $(($(date +%s) - T0)) s): see the hosts marked FAILED above."
	exit 1
fi
echo "shipped $version in $(($(date +%s) - T0)) s. Reload each window (Settings, About, Reload interface) or open it again."
