!include LogicLib.nsh
Var BerthAgentStopped

; Keep the old executable until all files have been copied. A failed install
; restores it before starting the old agent; box sessions remain on the boxes.
!macro NSIS_HOOK_PREINSTALL
  StrCpy $BerthAgentStopped 0
  ${If} ${FileExists} "$INSTDIR\berth-cli.exe"
    CopyFiles /SILENT "$INSTDIR\berth-cli.exe" "$INSTDIR\berth-cli.previous.exe"
    IfErrors berth_stop_failed
    nsExec::ExecToStack '"$INSTDIR\berth-cli.exe" agent status --json'
    Pop $0
    Pop $1
    ; Start is idempotent; only preserve a process that was actually running.
    ${StrLoc} $2 $1 '"running": true' '>'
    ${If} $2 != ""
      StrCpy $BerthAgentStopped 1
    ${Else}
      ${StrLoc} $2 $1 '"running":true' '>'
      ${If} $2 != ""
        StrCpy $BerthAgentStopped 1
      ${EndIf}
    ${EndIf}
    nsExec::ExecToStack '"$INSTDIR\berth-cli.exe" agent stop --drain'
    Pop $0
    Pop $1
    ${If} $0 != 0
      berth_stop_failed:
      SetErrorLevel 1
      Abort "Berth could not stop its local agent safely. The installed files were kept."
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $BerthAgentStopped = 1
    nsExec::ExecToStack '"$INSTDIR\berth-cli.exe" agent start'
    Pop $0
    Pop $1
  ${EndIf}
  Delete "$INSTDIR\berth-cli.previous.exe"
!macroend

Function .onInstFailed
  ${If} ${FileExists} "$INSTDIR\berth-cli.previous.exe"
    CopyFiles /SILENT "$INSTDIR\berth-cli.previous.exe" "$INSTDIR\berth-cli.exe"
    ${If} $BerthAgentStopped = 1
      nsExec::ExecToStack '"$INSTDIR\berth-cli.exe" agent start'
      Pop $0
      Pop $1
    ${EndIf}
  ${EndIf}
FunctionEnd

Function .onUserAbort
  ${If} $BerthAgentStopped = 1
    nsExec::ExecToStack '"$INSTDIR\berth-cli.exe" agent start'
    Pop $0
    Pop $1
  ${EndIf}
FunctionEnd

!macro NSIS_HOOK_PREUNINSTALL
  ${If} ${FileExists} "$INSTDIR\berth-cli.exe"
    nsExec::ExecToStack '"$INSTDIR\berth-cli.exe" agent stop --drain'
    Pop $0
    Pop $1
    ${If} $0 != 0
      SetErrorLevel 1
      Abort "Berth could not stop its local agent safely. Uninstall was cancelled."
    ${EndIf}
    ; The CLI verifies ownership before removing a per-user login task.
    nsExec::ExecToStack '"$INSTDIR\berth-cli.exe" agent uninstall'
    Pop $0
    Pop $1
    ${If} $0 != 0
      SetErrorLevel 1
      Abort "Berth could not remove its owned login task. Uninstall was cancelled."
    ${EndIf}
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\cli-path.ps1"
    nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -File "$INSTDIR\cli-path.ps1" -Action Remove -CliDirectory "$INSTDIR\cli"'
    Pop $0
    Pop $1
    ${If} $0 != 0
      SetErrorLevel 1
      Abort "Berth could not remove its PATH entry. Uninstall was cancelled."
    ${EndIf}
  ${EndIf}
  ; State is under the user's config directory, outside this installation.
!macroend
