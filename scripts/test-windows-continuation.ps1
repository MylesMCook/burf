param([Parameter(Mandatory = $true)][string]$Artifacts)
$ErrorActionPreference = 'Stop'
$Artifacts = (Resolve-Path -LiteralPath $Artifacts).Path
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Output "Native synthetic backend checks: machine=$([Environment]::MachineName), elevated=$elevated"
if ($elevated) { Write-Output 'These results do not establish ordinary-user or desktop acceptance.' }
$saved = [Environment]::GetEnvironmentVariable('BERTH_TEST_INSTALLED_LOCAL_AGENTS', 'Process')
$env:BERTH_TEST_INSTALLED_LOCAL_AGENTS = '0'
try {
    foreach ($name in 'localagent','localhistory','localpty','agent') {
        $binary = Join-Path $Artifacts "$name.test.exe"
        if (!(Test-Path -LiteralPath $binary -PathType Leaf)) { throw "Missing test artifact: $name" }
        & $binary '-test.v' '-test.timeout=180s'
        if ($LASTEXITCODE) { throw "Native $name tests failed ($LASTEXITCODE)" }
    }
    Write-Output 'PASS: synthetic native suites completed. No provider prompt, app deployment, login task or pairing was requested.'
} finally {
    [Environment]::SetEnvironmentVariable('BERTH_TEST_INSTALLED_LOCAL_AGENTS', $saved, 'Process')
}
