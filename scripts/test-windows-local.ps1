param(
    [Parameter(Mandatory = $true)][string]$Binary,
    [switch]$ExistingHistory
)
$ErrorActionPreference = 'Stop'
$Binary = (Resolve-Path -LiteralPath $Binary).Path
$state = Join-Path $env:TEMP ('berth-local-check-' + [Guid]::NewGuid().ToString('N'))
$saved = @{}
foreach ($name in 'BERTH_HOME','BERTH_USER_DIR','BERTH_UI_ADDR','BERTH_PROXY_ADDR','CODEX_HOME','CLAUDE_CONFIG_DIR') {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process')
}
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$env:BERTH_HOME = $state
$env:BERTH_USER_DIR = Join-Path $state 'user'
$env:BERTH_UI_ADDR = "127.0.0.1:$port"
$env:BERTH_PROXY_ADDR = '127.0.0.1:0'
if (!$ExistingHistory) {
    $env:CODEX_HOME = Join-Path $state 'codex'
    $env:CLAUDE_CONFIG_DIR = Join-Path $state 'claude'
    New-Item -ItemType Directory -Force $env:CODEX_HOME,$env:CLAUDE_CONFIG_DIR | Out-Null
}
$started = $false
try {
    & $Binary agent start | Out-Null
    if ($LASTEXITCODE) { throw 'Isolated client failed to start' }
    $started = $true
    $token = [IO.File]::ReadAllText((Join-Path $state 'client/ui-token')).Trim()
    $headers = @{ Authorization = "Bearer $token" }
    $endpoint = "http://127.0.0.1:$port"
    $local = Invoke-RestMethod -Headers $headers -Uri "$endpoint/v1/local" -TimeoutSec 30
    if (!$local.supported -or !$local.name -or $local.sessions.Count) { throw 'Local capability is incorrect' }
    $chats = Invoke-RestMethod -Headers $headers -Uri "$endpoint/v1/local/conversations" -TimeoutSec 30
    $chats = @($chats)
    if ($ExistingHistory) {
        foreach ($source in 'codex','claude') {
            $found = @($chats | Where-Object { $_.source -eq $source })
            if (!$found.Count) { throw "No existing $source conversations discovered" }
            $page = Invoke-RestMethod -Headers $headers -Uri "$endpoint/v1/local/conversations/$($found[0].id)" -TimeoutSec 30
            if (!$found[0].read_only -or !$page.items.Count) { throw "Existing $source history could not be read" }
            # Never log titles, paths, prompts, transcript items or the API token.
            Write-Output "PASS: $source history discovered ($($found.Count)); one read-only page parsed."
        }
    } else {
        if ($chats.Count) { throw 'Synthetic empty history was not empty' }
        $project = Join-Path $state 'project'
        New-Item -ItemType Directory -Force $project | Out-Null
        foreach ($tool in @($local.agents | Where-Object { $_.available })) {
            $session = $null
            try {
                $body = @{ agent = $tool.id; cwd = $project } | ConvertTo-Json
                $session = Invoke-RestMethod -Method Post -Headers $headers -ContentType 'application/json' -Body $body -Uri "$endpoint/v1/local/sessions" -TimeoutSec 30
                $until = [DateTime]::UtcNow.AddSeconds(15)
                do {
                    $output = Invoke-RestMethod -Headers $headers -Uri "$endpoint/v1/local/sessions/$($session.id)/output?after=0" -TimeoutSec 5
                    if ($output.data) { break }
                    if ($output.state -eq 'exited') { throw "$($tool.id) exited before terminal output" }
                    Start-Sleep -Milliseconds 100
                } while ([DateTime]::UtcNow -lt $until)
                if (!$output.data) { throw "$($tool.id) terminal did not produce output" }
                Start-Sleep -Milliseconds 500
                $output = Invoke-RestMethod -Headers $headers -Uri "$endpoint/v1/local/sessions/$($session.id)/output" -TimeoutSec 5
                if ($output.state -ne 'running') {
                    $diagnostic = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($output.data))
                    throw "$($tool.id) did not remain interactive: $($output.exit_error) $diagnostic"
                }
                $resize = @{ cols = 110; rows = 32 } | ConvertTo-Json
                Invoke-RestMethod -Method Post -Headers $headers -ContentType 'application/json' -Body $resize -Uri "$endpoint/v1/local/sessions/$($session.id)/resize" -TimeoutSec 5 | Out-Null
                Write-Output "PASS: installed $($tool.id) started through the local API with terminal output and resize. No prompt submitted."
            } finally {
                if ($session) {
                    Invoke-RestMethod -Method Delete -Headers $headers -Uri "$endpoint/v1/local/sessions/$($session.id)" -TimeoutSec 15 | Out-Null
                    $until = [DateTime]::UtcNow.AddSeconds(5)
                    do {
                        $output = Invoke-RestMethod -Headers $headers -Uri "$endpoint/v1/local/sessions/$($session.id)/output" -TimeoutSec 5
                        if ($output.state -eq 'exited') { break }
                        Start-Sleep -Milliseconds 100
                    } while ([DateTime]::UtcNow -lt $until)
                    if ($output.state -ne 'exited') { throw 'Owned test agent did not stop' }
                }
            }
        }
    }
    & $Binary agent stop --drain | Out-Null
    if ($LASTEXITCODE) { throw 'Isolated client failed to stop' }
    $started = $false
    $status = & $Binary agent status --json | ConvertFrom-Json
    if ($status.running -or $status.installed) { throw 'Check left a client or login task behind' }
    Write-Output 'PASS: native local capability and authenticated history API; isolated client stopped, no login task.'
} finally {
    if ($started) {
        & $Binary agent stop --drain | Out-Null
        if ($LASTEXITCODE -eq 0) { $started = $false }
    }
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
    if (!$started -and (Test-Path -LiteralPath $state)) { Remove-Item -LiteralPath $state -Recurse -Force }
}
