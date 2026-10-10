param([Parameter(Mandatory = $true)][string]$Binary)
$ErrorActionPreference = 'Stop'
$Binary = (Resolve-Path -LiteralPath $Binary).Path
$state = Join-Path ([IO.Path]::GetTempPath()) ('bw-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$saved = @{}
foreach ($name in 'BERTH_HOME', 'BERTH_USER_DIR', 'BERTH_UI_ADDR', 'BERTH_PROXY_ADDR') {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$uiPort = $listener.LocalEndpoint.Port
$listener.Stop()
$env:BERTH_HOME = $state
$env:BERTH_USER_DIR = Join-Path $state 'user'
$env:BERTH_UI_ADDR = "127.0.0.1:$uiPort"
$env:BERTH_PROXY_ADDR = '127.0.0.1:0'
$started = $false
function Invoke-Burf([string[]]$Arguments) {
    $output = & $Binary @Arguments
    if ($LASTEXITCODE -ne 0) { throw "berth $($Arguments -join ' ') failed" }
    return $output
}
try {
    Invoke-Burf @('agent', 'start') | Out-Null
    $started = $true
    $status = (Invoke-Burf @('status', '--json')) | ConvertFrom-Json
    if ($status.ssh_setup_supported -ne $false -or $status.boxes.Count -ne 0) { throw 'Fresh Windows client status is incorrect.' }
    $tokenFile = Join-Path $state 'client/ui-token'
    $token = [IO.File]::ReadAllText($tokenFile).Trim()
    $endpoint = "http://127.0.0.1:$uiPort"
    $unauthorized = $false
    try { Invoke-WebRequest -UseBasicParsing "$endpoint/v1/status" | Out-Null } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 401) { throw }
        $unauthorized = $true
    }
    if (!$unauthorized) { throw 'The app API accepted a request without its token.' }
    $headers = @{ Authorization = "Bearer $token"; Origin = 'http://wails.localhost' }
    $api = Invoke-WebRequest -UseBasicParsing -Headers $headers "$endpoint/v1/status"
    if ($api.Headers['Access-Control-Allow-Origin'] -ne 'http://wails.localhost') { throw 'Windows Wails origin was rejected.' }
    $info = Invoke-RestMethod -Headers $headers "$endpoint/v1/agent"
    if ($info.pid -le 0) { throw 'The agent did not report its process.' }
    Invoke-Burf @('agent', 'stop', '--drain') | Out-Null
    $started = $false
    if (Get-Process -Id $info.pid -ErrorAction SilentlyContinue) { throw 'Drain-stop returned before the process exited.' }
    $after = (Invoke-Burf @('agent', 'status', '--json')) | ConvertFrom-Json
    if ($after.running -or $after.installed) { throw 'Smoke test left a process or login task running.' }
    Write-Output 'PASS: native Windows start, status, private app API, Wails origin, and drained process exit. No login task was installed.'
} finally {
    if ($started) { & $Binary agent stop --drain | Out-Null }
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
    if (Test-Path -LiteralPath $state) { Remove-Item -LiteralPath $state -Recurse -Force }
}
