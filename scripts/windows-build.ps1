param(
    [string]$Version = 'dev',
    [switch]$Release,
    [switch]$StageOnly
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$versionNumber = $Version.TrimStart('v')
$stamp = if ($Version -eq 'dev') { 'dev' } else { "v$versionNumber" }
if ($Version -ne 'dev' -and $versionNumber -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must be dev or vX.Y.Z.' }
if ($Release -and ($Version -eq 'dev' -or !$env:TAURI_SIGNING_PRIVATE_KEY)) { throw 'Release needs a version and TAURI_SIGNING_PRIVATE_KEY.' }
$binaries = Join-Path $root 'app/src-tauri/binaries'
New-Item -ItemType Directory -Force $binaries | Out-Null
$ldflags = "-s -w -X github.com/sean-brydon/berthd/internal/version.Version=$stamp"
function Build-Go([string]$Os, [string]$Arch, [string]$Package, [string]$Output) {
    $oldOs, $oldArch, $oldCgo = $env:GOOS, $env:GOARCH, $env:CGO_ENABLED
    try {
        $env:GOOS, $env:GOARCH, $env:CGO_ENABLED = $Os, $Arch, '0'
        & go build -trimpath -ldflags $ldflags -o $Output $Package
        if ($LASTEXITCODE -ne 0) { throw "Go build failed for $Os/$Arch $Package" }
    } finally { $env:GOOS, $env:GOARCH, $env:CGO_ENABLED = $oldOs, $oldArch, $oldCgo }
}
Push-Location $root
try {
    $sidecar = Join-Path $binaries 'berth-cli-x86_64-pc-windows-msvc.exe'
    Build-Go windows amd64 ./cmd/berth $sidecar
    Copy-Item $sidecar (Join-Path $binaries 'berth-windows-amd64.exe') -Force
    foreach ($arch in 'amd64', 'arm64') {
        Build-Go linux $arch ./cmd/berthd (Join-Path $binaries "berthd-linux-$arch")
        $tmux = Join-Path $root "bin/tmux-linux-$arch"
        if (!(Test-Path $tmux -PathType Leaf)) { throw "Missing $tmux. Build remote helpers with scripts/build-tmux.sh on a Docker host first." }
        Copy-Item $tmux $binaries -Force
    }
    if ($StageOnly) { return }
    if ($env:OS -ne 'Windows_NT') { throw 'The desktop installer must be built on Windows.' }
    & node (Join-Path $PSScriptRoot 'windows-installer-template.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'The locked Windows installer template could not be prepared.' }
    Push-Location (Join-Path $root 'app')
    $oldFork = $env:VITE_BERTH_FORK
    try {
        $env:VITE_BERTH_FORK = 'true'
        $arguments = @('tauri', 'build', '--target', 'x86_64-pc-windows-msvc', '--config', 'src-tauri/tauri.windows.conf.json', '--config', 'src-tauri/tauri.windows.bundle.conf.json')
        if ($Version -ne 'dev') {
            $versionConfig = Join-Path $binaries 'windows.version.conf.json'
            [IO.File]::WriteAllText($versionConfig, (@{ version = $versionNumber } | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
            $arguments += @('--config', $versionConfig)
        }
        if ($Release) { $arguments += @('--config', 'src-tauri/tauri.updater.conf.json') }
        & pnpm @arguments
        if ($LASTEXITCODE -ne 0) { throw 'Tauri Windows build failed.' }
    } finally { $env:VITE_BERTH_FORK = $oldFork; Pop-Location }
    $out = Join-Path $root 'dist/windows'
    New-Item -ItemType Directory -Force $out | Out-Null
    $bundle = Join-Path $root 'app/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis'
    $installers = @(Get-ChildItem $bundle -Filter '*-setup.exe')
    if ($installers.Count -ne 1) { throw 'Expected exactly one NSIS installer.' }
    $installer = Join-Path $out 'Berth-windows-x64-setup.exe'
    Copy-Item $installers[0].FullName $installer -Force
    $cliStage = Join-Path $out 'cli-stage'
    New-Item -ItemType Directory -Force $cliStage | Out-Null
    Copy-Item $sidecar (Join-Path $cliStage 'berth.exe') -Force
    foreach ($arch in 'amd64', 'arm64') {
        Copy-Item (Join-Path $binaries "berthd-linux-$arch") $cliStage -Force
        Copy-Item (Join-Path $binaries "tmux-linux-$arch") $cliStage -Force
    }
    Compress-Archive -Path "$cliStage/*" -DestinationPath (Join-Path $out 'berth-windows-amd64.zip') -Force
    Remove-Item $cliStage -Recurse -Force
    if ($Release) {
        $signature = $installers[0].FullName + '.sig'
        if (!(Test-Path $signature)) { throw 'The installer updater signature is missing.' }
        Copy-Item $signature ($installer + '.sig') -Force
        $repository = if ($env:GITHUB_REPOSITORY) { $env:GITHUB_REPOSITORY } else { 'sean-brydon/berthd' }
        $feed = [ordered]@{
            version = $versionNumber
            notes = "Berth $versionNumber`: https://github.com/$repository/releases/tag/$stamp"
            pub_date = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
            platforms = @{ 'windows-x86_64' = @{ signature = (Get-Content $signature -Raw).Trim(); url = "https://github.com/$repository/releases/download/$stamp/Berth-windows-x64-setup.exe" } }
        }
        [IO.File]::WriteAllText((Join-Path $out 'latest-windows.json'), ($feed | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    }
    Get-ChildItem $out -File | Where-Object { $_.Name -ne 'windows-checksums.txt' } | ForEach-Object {
        '{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name
    } | Set-Content (Join-Path $out 'windows-checksums.txt') -Encoding ascii
} finally { Pop-Location }
