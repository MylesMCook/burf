# Manual acceptance only. Requires explicit approval for this Windows host.
# Installs into a new temporary directory, registers one synthetic login task,
# adds one consented PATH entry, then cleans up through the supported uninstaller.
param(
    [Parameter(Mandatory)][string]$Installer,
    [Parameter(Mandatory)][string]$UpgradeInstaller
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This acceptance runner requires Windows.' }
$repository = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
$pathSource = Join-Path $repository 'scripts/windows/cli-path.ps1'
if (!(Test-Path -LiteralPath $pathSource -PathType Leaf)) { throw 'Invoke inline acceptance from the repository root so its reviewed PATH command can be found.' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run as the ordinary login user, without elevation.' }
$Installer = (Resolve-Path -LiteralPath $Installer).Path
$UpgradeInstaller = (Resolve-Path -LiteralPath $UpgradeInstaller).Path
if ((Get-FileHash -LiteralPath $Installer).Hash -eq (Get-FileHash -LiteralPath $UpgradeInstaller).Hash) { throw 'UpgradeInstaller must be a different, higher-version artifact.' }
$installVersion = [version]([Diagnostics.FileVersionInfo]::GetVersionInfo($Installer).ProductVersion)
$upgradeVersion = [version]([Diagnostics.FileVersionInfo]::GetVersionInfo($UpgradeInstaller).ProductVersion)
if ($upgradeVersion -le $installVersion) { throw 'UpgradeInstaller must have a higher product version.' }

$guardKeys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Burf',
    'HKCU:\Software\berth\Burf', 'HKLM:\Software\berth\Burf',
    'HKCU:\Software\Classes\berth', 'HKLM:\Software\Classes\berth',
    'HKCU:\Software\Burf\CommandLine'
)
foreach ($key in $guardKeys) {
    if (Test-Path -LiteralPath $key) { throw "Pre-existing Burf registration would be replaced: $key" }
}
$shortcuts = @(
    (Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Burf.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'Burf.lnk'),
    (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'Burf.lnk'),
    (Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'Burf.lnk')
)
foreach ($shortcut in $shortcuts) {
    if (Test-Path -LiteralPath $shortcut) { throw 'A pre-existing Burf shortcut would be replaced.' }
}
$webviewKeys = @(
    'HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKLM:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKLM:\Software\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
)
$webviewPresent = @($webviewKeys | Where-Object {
    (Test-Path -LiteralPath $_) -and ![string]::IsNullOrEmpty((Get-ItemProperty -LiteralPath $_ -Name pv -ErrorAction SilentlyContinue).pv)
}).Count -gt 0
if (!$webviewPresent) { throw 'WebView2 is missing. This runner will not permit the installer to download a prerequisite.' }

function Read-UserPath {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')
    try { return [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) }
    finally { $key.Dispose() }
}
$scheduler = New-Object -ComObject 'Schedule.Service'
$scheduler.Connect()
$taskFolder = $scheduler.GetFolder('\')
function Read-TaskNames { return @($taskFolder.GetTasks(1) | ForEach-Object { $_.Path } | Sort-Object) }
$baselineTasks = @(Read-TaskNames)
function Tasks-MatchBaseline { return ((@(Read-TaskNames) -join "`n") -ceq ($baselineTasks -join "`n")) }
$baselinePath = Read-UserPath
$originalState = if ($env:BERTH_HOME) { $env:BERTH_HOME } else { Join-Path $env:APPDATA 'berth' }
$personalHashes = @{}
foreach ($leaf in 'client/identity.pem', 'client/boxes.json') {
    $path = Join-Path $originalState $leaf
    if (Test-Path -LiteralPath $path -PathType Leaf) { $personalHashes[$path] = (Get-FileHash -LiteralPath $path).Hash }
}
$saved = @{}
foreach ($name in 'BERTH_HOME', 'BERTH_USER_DIR', 'BERTH_UI_ADDR', 'BERTH_PROXY_ADDR') {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
# The per-run folder is disposable, but not under OS TEMP: login tasks refuse
# temporary compiler binaries. Retain its synthetic keys and evidence afterward.
$runRoot = Join-Path ([Environment]::GetFolderPath('MyDocuments')) ('Codex\' + [DateTime]::Now.ToString('yyyy-MM-dd') + '-windows-install-' + [Guid]::NewGuid().ToString('N'))
$installRoot = Join-Path $runRoot 'Burf app'
$stateRoot = Join-Path $runRoot "Burf's state & data"
$evidence = Join-Path $runRoot 'evidence'
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
$log = Join-Path $evidence 'acceptance.log'
$events = [Collections.Generic.List[string]]::new()
$uninstalled = $false
$activeInstaller = $null
$knownAgent = $null
$testTask = $null
$failure = $null

function Assert-Acceptance([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw $Message }
}
function Record-Step([string]$Step) {
    $events.Add($Step)
    [IO.File]::AppendAllText($log, [DateTime]::UtcNow.ToString('o') + ' ' + $Step + [Environment]::NewLine)
}
function Free-Port {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    try { $listener.Start(); return $listener.LocalEndpoint.Port } finally { $listener.Stop() }
}
function Invoke-Installer([string]$Artifact) {
    # NSIS requires /D last and unquoted, including when the path has spaces.
    $script:activeInstaller = Start-Process -FilePath $Artifact -ArgumentList "/S /D=$installRoot" -PassThru
    if (!$script:activeInstaller.WaitForExit(240000)) { throw 'The task-owned installer timed out. Inspect its PID before attempting cleanup.' }
    if ($script:activeInstaller.ExitCode -ne 0) { throw "Installer failed with exit code $($script:activeInstaller.ExitCode)." }
    $script:activeInstaller = $null
}
function Invoke-Burf([string]$Binary, [string[]]$Arguments) {
    if (!(Test-Path -LiteralPath $Binary -PathType Leaf)) { throw 'The synthetic client executable is missing.' }
    $previousPolicy = $ErrorActionPreference
    try {
        # Windows PowerShell turns native stderr into error records. Collect
        # all of them before checking the exit code, then restore caller policy.
        $ErrorActionPreference = 'Continue'
        $output = & $Binary @Arguments 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPolicy }
    $text = $output -join [Environment]::NewLine
    if ($code -ne 0) {
        $text | Out-File (Join-Path $evidence 'cli-failure.log') -Append
        throw "The synthetic client command failed: $($Arguments -join ' ')."
    }
    return $text
}
function Agent-Status([string]$Binary) { return (Invoke-Burf $Binary @('agent', 'status', '--json')) | ConvertFrom-Json }
function Read-Agent {
    $token = [IO.File]::ReadAllText((Join-Path $stateRoot 'client/ui-token')).Trim()
    return Invoke-RestMethod -Uri "$endpoint/v1/agent" -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 3
}
function Wait-Agent([string]$ExpectedExe, [int]$PreviousPID = 0) {
    $until = [DateTime]::UtcNow.AddSeconds(45)
    while ([DateTime]::UtcNow -lt $until) {
        try {
            $info = Read-Agent
            if ($info.pid -gt 0 -and $info.pid -ne $PreviousPID -and $info.exe -ieq $ExpectedExe) { return $info }
        } catch { }
        Start-Sleep -Milliseconds 200
    }
    throw 'The isolated agent did not answer from the expected executable and loopback port.'
}
function Invoke-PathAction([string]$Action) {
    $source = [IO.File]::ReadAllText($pathSource)
    $directory = (Join-Path $installRoot 'cli').Replace("'", "''")
    $command = "& {`n$source`n} -Action '$Action' -CliDirectory '$directory'"
    $powerShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $result = & $powerShell -NoProfile -NonInteractive -Command $command 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'The existing embedded PATH command failed under the current PowerShell policy.' }
    return ($result -join [Environment]::NewLine).Trim()
}
function Uninstall-TestCopy {
    $uninstaller = Join-Path $installRoot 'uninstall.exe'
    if (!(Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw 'The test copy has no supported uninstaller. Keep the evidence and inspect before cleanup.' }
    # _?= keeps the task-owned uninstaller synchronous rather than spawning a temp copy.
    $process = Start-Process -FilePath $uninstaller -ArgumentList "/S _?=$installRoot" -PassThru
    if (!$process.WaitForExit(180000) -or $process.ExitCode -ne 0) { throw 'The supported uninstaller did not complete successfully.' }
    $script:uninstalled = $true
    # The installer retains an install-location preference without deleting app data.
    # Remove only this synthetic run's exact preference, not shared app data.
    $path = 'Software\berth\Burf'
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($path, $true)
    if ($key) {
        try {
            $names = @($key.GetValueNames())
            Assert-Acceptance ($key.SubKeyCount -eq 0 -and $names.Count -eq 1 -and $names[0] -eq '' -and $key.GetValue('') -ieq $installRoot) 'An unrelated install-location preference must be preserved.'
            $key.DeleteValue('', $true)
        } finally { $key.Dispose() }
        [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($path, $false)
    }
}

try {
    $uiPort = Free-Port
    do { $proxyPort = Free-Port } while ($proxyPort -eq $uiPort)
    $env:BERTH_HOME = $stateRoot
    $env:BERTH_USER_DIR = Join-Path $stateRoot 'user'
    $env:BERTH_UI_ADDR = "127.0.0.1:$uiPort"
    $env:BERTH_PROXY_ADDR = "127.0.0.1:$proxyPort"
    $endpoint = "http://127.0.0.1:$uiPort"
    Record-Step 'Preflight passed; synthetic home, user directory and unique loopback ports selected.'
    Invoke-Installer $Installer
    $sidecar = Join-Path $installRoot 'burf-cli.exe'
    $cli = Join-Path (Join-Path $installRoot 'cli') 'burf.exe'
    Assert-Acceptance ((Test-Path $sidecar -PathType Leaf) -and (Test-Path $cli -PathType Leaf)) 'The installed package is missing a CLI candidate.'
    Assert-Acceptance ((Read-UserPath) -ceq $baselinePath) 'Fresh installation changed user PATH.'
    Assert-Acceptance (!(Test-Path 'HKCU:\Software\Burf\CommandLine')) 'Fresh installation created PATH consent.'
    Assert-Acceptance (Tasks-MatchBaseline) 'Fresh installation registered a task.'
    $fresh = Agent-Status $sidecar
    Assert-Acceptance (!$fresh.running -and !$fresh.installed) 'Fresh installation started or installed an agent without consent.'
    Record-Step 'Fresh installer changed neither startup nor PATH.'

    Invoke-Burf $sidecar @('agent', 'start') | Out-Null
    $knownAgent = Wait-Agent $sidecar
    $privateAPI = $false
    try { Invoke-WebRequest -UseBasicParsing -Uri "$endpoint/v1/status" -TimeoutSec 3 | Out-Null } catch {
        $privateAPI = $_.Exception.Response.StatusCode.value__ -eq 401
    }
    Assert-Acceptance $privateAPI 'The isolated app API accepted an unauthenticated request.'
    $identityPath = Join-Path $stateRoot 'client/identity.pem'
    $tokenPath = Join-Path $stateRoot 'client/ui-token'
    $identityHash = (Get-FileHash -LiteralPath $identityPath).Hash
    $tokenHash = (Get-FileHash -LiteralPath $tokenPath).Hash
    Record-Step 'Private sidecar started an actual process and token-protected API.'

    # Exercise the public CLI resource as the login-task owner, not the sidecar.
    Invoke-Burf $cli @('agent', 'install') | Out-Null
    $knownAgent = Wait-Agent $cli $knownAgent.pid
    $newTasks = @(Read-TaskNames | Where-Object { $baselineTasks -notcontains $_ })
    Assert-Acceptance ($newTasks.Count -eq 1) 'Opt-in startup did not create exactly one task.'
    $testTask = $newTasks[0]
    $task = $taskFolder.GetTask($testTask)
    [xml]$xml = $task.Xml
    $namespace = [Xml.XmlNamespaceManager]::new($xml.NameTable)
    $namespace.AddNamespace('t', 'http://schemas.microsoft.com/windows/2004/02/mit/task')
    $user = $xml.SelectSingleNode('/t:Task/t:Principals/t:Principal', $namespace)
    Assert-Acceptance ($user.UserId -eq $identity.User.Value -and $user.LogonType -eq 'InteractiveToken' -and $user.RunLevel -eq 'LeastPrivilege') 'The test login task changed its user or privilege boundary.'
    $metadata = $xml.SelectSingleNode('/t:Task/t:RegistrationInfo/t:Source', $namespace).InnerText
    Assert-Acceptance ($metadata.StartsWith('berth-task-v1:')) 'The test task lacks Burf ownership metadata.'
    $stored = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($metadata.Substring('berth-task-v1:'.Length))) | ConvertFrom-Json
    foreach ($name in 'BERTH_HOME', 'BERTH_USER_DIR', 'BERTH_UI_ADDR', 'BERTH_PROXY_ADDR') {
        Assert-Acceptance ($stored.spec.Env.$name -ceq [Environment]::GetEnvironmentVariable($name, 'Process')) 'The login task lost an explicit isolated environment value.'
    }
    Assert-Acceptance ($stored.spec.Program -ieq $cli) 'The login task is not owned by the bundled public CLI.'
    Record-Step 'Opt-in startup uses the current user, least privilege and literal synthetic environment.'

    Invoke-PathAction 'Add' | Out-Null
    $expectedPath = if ($baselinePath -eq '') { Split-Path $cli } else { $baselinePath + ';' + (Split-Path $cli) }
    Assert-Acceptance ((Read-UserPath) -ceq $expectedPath) 'PATH consent changed more than the exact CLI folder.'
    Assert-Acceptance ((Invoke-PathAction 'Status') -eq 'linked') 'The added PATH entry lacks ownership.'
    Record-Step 'Explicit PATH consent added exactly the installed CLI folder.'

    $beforeUpgrade = $knownAgent
    $beforeVersion = Invoke-Burf $cli @('version')
    Invoke-Installer $UpgradeInstaller
    $knownAgent = Wait-Agent $cli $beforeUpgrade.pid
    Assert-Acceptance (!(Get-Process -Id $beforeUpgrade.pid -ErrorAction SilentlyContinue)) 'Upgrade returned while the old agent process still existed.'
    Assert-Acceptance ((Invoke-Burf $cli @('version')) -cne $beforeVersion) 'The higher-version artifact did not change the bundled CLI version.'
    Assert-Acceptance ((Agent-Status $cli).installed) 'Upgrade lost opt-in login startup.'
    Assert-Acceptance ((Read-UserPath) -ceq $expectedPath -and (Invoke-PathAction 'Status') -eq 'linked') 'Upgrade lost or modified PATH consent.'
    Assert-Acceptance ((Get-FileHash $identityPath).Hash -eq $identityHash -and (Get-FileHash $tokenPath).Hash -eq $tokenHash) 'Upgrade changed the synthetic client keys.'
    Assert-Acceptance ($taskFolder.GetTask($testTask).State -eq 4) 'Upgrade left the owned login task stopped.'
    Record-Step 'Manual higher-version upgrade exited the old PID, restarted the new version and retained keys/task/PATH.'

    Invoke-Burf $cli @('agent', 'stop', '--drain') | Out-Null
    Assert-Acceptance (!(Get-Process -Id $knownAgent.pid -ErrorAction SilentlyContinue)) 'Clean stop returned before process exit.'
    $knownAgent = $null
    # Task Scheduler's crash retry interval is one minute; observe past it.
    $until = [DateTime]::UtcNow.AddSeconds(65)
    while ([DateTime]::UtcNow -lt $until) {
        Assert-Acceptance (!(Agent-Status $cli).running) 'The cleanly stopped agent restarted without a request.'
        Start-Sleep -Seconds 2
    }
    Record-Step 'Clean stop stayed stopped beyond the crash retry interval.'
    Uninstall-TestCopy
    Assert-Acceptance (!(Test-Path (Join-Path $installRoot 'Burf.exe')) -and !(Test-Path $cli) -and !(Test-Path $sidecar)) 'Uninstall retained client executables.'
    Assert-Acceptance ((Get-FileHash $identityPath).Hash -eq $identityHash -and (Get-FileHash $tokenPath).Hash -eq $tokenHash) 'Uninstall removed or changed retained synthetic keys.'
    Record-Step 'Supported uninstall removed the app/task/PATH and retained synthetic keys.'
} catch {
    $failure = $_.Exception.Message
    Record-Step ('FAIL: ' + $failure)
} finally {
    try {
        if (!$uninstalled -and (!$activeInstaller -or $activeInstaller.HasExited) -and (Test-Path (Join-Path $installRoot 'uninstall.exe'))) { Uninstall-TestCopy }
        Assert-Acceptance (!$activeInstaller -or $activeInstaller.HasExited) 'A task-owned installer remains active; inspect before cleanup.'
        Assert-Acceptance (Tasks-MatchBaseline) 'Cleanup did not restore the baseline task set.'
        Assert-Acceptance ((Read-UserPath) -ceq $baselinePath) 'Cleanup did not restore the exact user PATH.'
        foreach ($key in $guardKeys) { Assert-Acceptance (!(Test-Path -LiteralPath $key)) 'Cleanup retained a test product or URL/PATH registration.' }
        foreach ($shortcut in $shortcuts) { Assert-Acceptance (!(Test-Path -LiteralPath $shortcut)) 'Cleanup retained a test shortcut.' }
        foreach ($path in $personalHashes.Keys) { Assert-Acceptance ((Get-FileHash -LiteralPath $path).Hash -eq $personalHashes[$path]) 'A personal preview identity or pairing file changed.' }
        Record-Step 'Cleanup restored task/PATH/registration baselines and preserved personal preview pairings.'
    } catch {
        $failure = if ($failure) { $failure + ' Cleanup: ' + $_.Exception.Message } else { $_.Exception.Message }
        Record-Step ('CLEANUP FAILURE: ' + $_.Exception.Message)
    }
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
    @{ passed = !$failure; steps = @($events); error = $failure; retained_state = $stateRoot } | ConvertTo-Json -Depth 3 | Out-File (Join-Path $evidence 'result.json') -Encoding utf8
}
if ($failure) { throw "Windows install acceptance failed: $failure Local evidence: $evidence" }
Write-Output "PASS: isolated install, startup, PATH, upgrade, clean stop and uninstall. Local evidence: $evidence"
