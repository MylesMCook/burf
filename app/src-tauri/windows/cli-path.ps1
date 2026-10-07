param(
    [Parameter(Mandatory)][ValidateSet('Status', 'Add', 'Remove')][string]$Action,
    [Parameter(Mandatory)][string]$CliDirectory
)
$ErrorActionPreference = 'Stop'
$directory = [IO.Path]::GetFullPath($CliDirectory).TrimEnd('\')
$ownerKey = 'HKCU:\Software\Berth\CommandLine'
$environment = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
if ($null -eq $environment) { throw 'The user Environment registry key is unavailable.' }
try {
    $path = [string]$environment.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    $parts = @($path.Split(';') | Where-Object { $_ -ne '' })
    $present = @($parts | Where-Object { $_.TrimEnd('\') -ieq $directory }).Count -gt 0
    $owned = (Get-ItemProperty -LiteralPath $ownerKey -Name Directory -ErrorAction SilentlyContinue).Directory
    if ($Action -eq 'Status') {
        if ($present -and $owned -ieq $directory) { 'linked' } elseif ($present) { 'external' } else { 'missing' }
        exit 0
    }
    if ($Action -eq 'Add') {
        if (!(Test-Path -LiteralPath (Join-Path $directory 'berth.exe') -PathType Leaf)) { throw 'The bundled berth.exe is missing.' }
        if (!$present) {
            $parts += $directory
            New-Item -Path $ownerKey -Force | Out-Null
            Set-ItemProperty -LiteralPath $ownerKey -Name Directory -Value $directory
        }
    } elseif ($owned -ieq $directory) {
        $parts = @($parts | Where-Object { $_.TrimEnd('\') -ine $directory })
        Remove-Item -LiteralPath $ownerKey -ErrorAction Stop
    } else {
        exit 0
    }
    $kind = if ($environment.GetValueNames() -contains 'Path') { $environment.GetValueKind('Path') } else { [Microsoft.Win32.RegistryValueKind]::ExpandString }
    $environment.SetValue('Path', ($parts -join ';'), $kind)
} finally {
    $environment.Dispose()
}
# Existing terminals keep their environment; Explorer gets the new value.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BerthEnvironment {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, UIntPtr w, string l, uint f, uint t, out UIntPtr r);
}
'@
$result = [UIntPtr]::Zero
[void][BerthEnvironment]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)
