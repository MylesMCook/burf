param(
    [string]$Version = 'dev',
    [ValidateSet('amd64', 'arm64')][string]$Architecture = 'amd64',
    [switch]$Release,
    [switch]$StageOnly
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ($env:OS -ne 'Windows_NT') { throw 'Use scripts/native-build.sh windows <architecture> for cross-build staging. This installer is built on Windows.' }
if ($Release) { throw 'Release signing and publication remain disabled until an approved Windows signing workflow exists.' }
$versionNumber = (& node (Join-Path $PSScriptRoot 'native-prepare.mjs') version $Version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Version must be dev or vX.Y.Z.' }
$stamp = if ($Version -eq 'dev') { 'dev' } else { "v$versionNumber" }
$out = Join-Path $root "dist/native/windows-$Architecture"
$artifacts = Join-Path $root 'dist/windows'
New-Item -ItemType Directory -Force (Join-Path $out 'cli'), $artifacts | Out-Null
$oldOs, $oldArch, $oldCgo, $oldCache = $env:GOOS, $env:GOARCH, $env:CGO_ENABLED, $env:GOCACHE
if (!$env:GOCACHE) { $env:GOCACHE = Join-Path $root 'bin/go-cache' }
$cliFlags = "-s -w -X github.com/MylesMCook/burf/internal/version.Version=$stamp"
function Invoke-Node([string[]]$Arguments) {
    & node @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Build helper failed: $($Arguments[0])" }
}
function Build-Go([string]$Os, [string]$Arch, [string]$Package, [string]$Output, [string]$Flags) {
    $env:GOOS, $env:GOARCH, $env:CGO_ENABLED = $Os, $Arch, '0'
    & go build -tags production -trimpath -ldflags $Flags -o $Output $Package
    if ($LASTEXITCODE -ne 0) { throw "Go build failed for $Os/$Arch $Package" }
}
Push-Location $root
try {
    Build-Go windows $Architecture ./cmd/burf (Join-Path $out 'berth-cli.exe') $cliFlags
    Copy-Item (Join-Path $out 'berth-cli.exe') (Join-Path $out 'burf-cli.exe') -Force
    Copy-Item (Join-Path $out 'berth-cli.exe') (Join-Path $out 'cli/burf.exe') -Force
    Copy-Item (Join-Path $out 'berth-cli.exe') (Join-Path $out 'cli/berth.exe') -Force
    foreach ($arch in 'amd64', 'arm64') {
        Build-Go linux $arch ./cmd/burfd (Join-Path $out "berthd-linux-$arch") $cliFlags
        $tmux = Join-Path $root "bin/tmux-linux-$arch"
        if (Test-Path -LiteralPath $tmux -PathType Leaf) { Copy-Item -LiteralPath $tmux -Destination $out -Force }
    }
    Invoke-Node @((Join-Path $PSScriptRoot 'webview2-loader.mjs'), $Architecture, $out)
    $loader = Join-Path $out 'WebView2Loader.dll'
    $signature = Get-AuthenticodeSignature -LiteralPath $loader
    if ($signature.Status -ne 'Valid' -or !$signature.SignerCertificate -or
        $signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false) -ne 'Microsoft Corporation') {
        throw 'WebView2 loader Microsoft Authenticode validation failed.'
    }
    $env:GOOS, $env:GOARCH, $env:CGO_ENABLED = $oldOs, $oldArch, $oldCgo
    Invoke-Node @((Join-Path $PSScriptRoot 'native-prepare.mjs'), 'bindings')
    Invoke-Node @((Join-Path $PSScriptRoot 'wails-cli.mjs'), 'generate', 'bindings', '-ts', '-names', '-d', '../bindings', '.')
    Push-Location (Join-Path $root 'app')
    $oldFork = $env:VITE_BERTH_FORK
    try {
        $env:VITE_BERTH_FORK = 'true'
        & pnpm build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { $env:VITE_BERTH_FORK = $oldFork; Pop-Location }
    Invoke-Node @((Join-Path $PSScriptRoot 'native-prepare.mjs'), 'assets')
    Invoke-Node @((Join-Path $PSScriptRoot 'native-prepare.mjs'), 'windows', $Version)
    $syso = Join-Path $root "app/native/rsrc_windows_$Architecture.syso"
    Invoke-Node @((Join-Path $PSScriptRoot 'wails-cli.mjs'), 'generate', 'syso', '-arch', $Architecture,
        '-icon', (Join-Path $root 'design/branding/exports/burf-app-icon.ico'),
        '-info', (Join-Path $root 'bin/native/windows-info.json'), '-manifest', (Join-Path $root 'bin/native/windows.manifest'), '-out', $syso)
    $buildId = (& git rev-parse --short=12 HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not record the app build commit.' }
    Push-Location (Join-Path $root 'app/native')
    try { Build-Go windows $Architecture . (Join-Path $out 'Burf.exe') "-s -w -H windowsgui -X main.version=$versionNumber+$buildId" }
    finally { Remove-Item -LiteralPath $syso -ErrorAction SilentlyContinue; Pop-Location }
    Copy-Item (Join-Path $root 'LICENSE') (Join-Path $out 'LICENSE.txt') -Force
    $label = if ($Architecture -eq 'amd64') { 'x64' } else { 'arm64' }
    Compress-Archive -Path (Join-Path $out '*') -DestinationPath (Join-Path $artifacts "Burf-windows-$label.zip") -Force
    $cliFiles = @((Join-Path $out 'cli/burf.exe'), (Join-Path $out 'cli/berth.exe')) + @(Get-ChildItem $out -File | Where-Object { $_.Name -like 'berthd-linux-*' -or $_.Name -like 'tmux-linux-*' } | ForEach-Object { $_.FullName })
    Compress-Archive -Path $cliFiles -DestinationPath (Join-Path $artifacts "burf-windows-$Architecture.zip") -Force
    if (!$StageOnly) {
        $compiler = $null
        if ($env:NSIS_COMPILER) {
            if (![IO.Path]::IsPathRooted($env:NSIS_COMPILER) -or !(Test-Path -LiteralPath $env:NSIS_COMPILER -PathType Leaf)) { throw 'NSIS_COMPILER must name an existing absolute makensis.exe path.' }
            $compiler = @{ Source = $env:NSIS_COMPILER }
        } else { $compiler = Get-Command makensis.exe -ErrorAction SilentlyContinue }
        if (!$compiler) {
            $candidate = Join-Path ${env:ProgramFiles(x86)} 'NSIS/makensis.exe'
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { $compiler = @{ Source = $candidate } }
        }
        if (!$compiler) { throw "The Go app and ZIP are staged in $artifacts. NSIS is not installed; this script does not install tools." }
        $installer = Join-Path $artifacts "Burf-windows-$label-setup.exe"
        $template = Join-Path $root 'bin/native/windows-installer.nsi'
        Invoke-Node @((Join-Path $PSScriptRoot 'windows-installer-template.mjs'), $out, $installer, $versionNumber, $Architecture, $template)
        & $compiler.Source $template
        if ($LASTEXITCODE -ne 0) { throw 'The project-owned Windows installer could not be built.' }
    }
    Get-ChildItem $artifacts -File | Where-Object { $_.Name -ne 'windows-checksums.txt' } | ForEach-Object {
        '{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name
    } | Set-Content (Join-Path $artifacts 'windows-checksums.txt') -Encoding ascii
} finally {
    if ($syso) { Remove-Item -LiteralPath $syso -ErrorAction SilentlyContinue }
    $env:GOOS, $env:GOARCH, $env:CGO_ENABLED, $env:GOCACHE = $oldOs, $oldArch, $oldCgo, $oldCache
    Pop-Location
}
