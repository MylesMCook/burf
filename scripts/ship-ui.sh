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
# where the Windows preview keeps it. `burf ui rollback` on a machine puts
# the previous interface back.
set -eu
cd "$(dirname "$0")/.."
T0="$(date +%s)"
hosts="${*:-${BURF_SHIP_HOSTS:-}}"

(cd app && pnpm exec vite build --logLevel error)
node scripts/ui-manifest.mjs app/dist
version="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("app/dist/manifest.json","utf8")).version)')"
echo "built $version in $(($(date +%s) - T0)) s"

burf="$(command -v burf || true)"
[ -n "$burf" ] || burf=/Applications/Burf.app/Contents/MacOS/burf-cli
"$burf" ui install app/dist
"$burf" ui status

if [ -n "$hosts" ]; then
	zip="$(mktemp -d)/burf-ui.zip"
	(cd app/dist && zip -qr "$zip" .)
	for host in $hosts; do
		(
			scp -q -o ConnectTimeout=10 "$zip" "$host:burf-ui.zip"
			# One line for a POSIX shell or for Windows' cmd: both run powershell
			# or sh as they have it; the CLI is on PATH or in the preview's folder.
			ssh -o ConnectTimeout=10 "$host" 'powershell -NoProfile -Command -' <<'EOF' 2>/dev/null || ssh -o ConnectTimeout=10 "$host" 'burf ui install burf-ui.zip && burf ui status && rm -f burf-ui.zip'
$cli = (Get-Command burf -ErrorAction SilentlyContinue).Source
if (!$cli) { $cli = Join-Path $env:LOCALAPPDATA 'BerthLocalPreview\cli\burf.exe' }
$zip = Join-Path $HOME 'burf-ui.zip'
& $cli ui install $zip
if ($LASTEXITCODE) { exit $LASTEXITCODE }
& $cli ui status
Remove-Item $zip -Force
EOF
			echo "$host: installed"
		) &
	done
	wait
fi
echo "shipped $version in $(($(date +%s) - T0)) s. Reload each window (Settings, About, Reload interface) or open it again."
