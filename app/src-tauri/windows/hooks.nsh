!include LogicLib.nsh
!define MUI_CUSTOMFUNCTION_ABORT BerthRecover
${UnStrLoc}
Var BerthAgentProgram
Var BerthLoginProgram
Var BerthWasRunning
Var BerthAgentStopped
Var BerthStatus

!macro BerthFlag NAME RESULT CONTEXT
  StrCpy ${RESULT} 0
!if "${CONTEXT}" == "uninstall"
  ${UnStrLoc} $2 $BerthStatus '"${NAME}": true' '>'
!else
  ${StrLoc} $2 $BerthStatus '"${NAME}": true' '>'
!endif
  ${If} $2 != ""
    StrCpy ${RESULT} 1
  ${Else}
!if "${CONTEXT}" == "uninstall"
    ${UnStrLoc} $2 $BerthStatus '"${NAME}":true' '>'
!else
    ${StrLoc} $2 $BerthStatus '"${NAME}":true' '>'
!endif
    ${If} $2 != ""
      StrCpy ${RESULT} 1
    ${EndIf}
  ${EndIf}
!macroend

!macro BerthInspect PROGRAM CONTEXT
  ${If} ${FileExists} "${PROGRAM}"
    nsExec::ExecToStack '"${PROGRAM}" agent status --json'
    Pop $0
    Pop $BerthStatus
    ${If} $0 != 0
      SetErrorLevel 1
      Abort "Burf could not inspect the current client safely. The installed files were kept."
    ${EndIf}
    !insertmacro BerthFlag "installed" $1 "${CONTEXT}"
    ${If} $1 = 1
      StrCpy $BerthLoginProgram "${PROGRAM}"
    ${EndIf}
    !insertmacro BerthFlag "owned_running" $1 "${CONTEXT}"
    ${If} $1 = 1
      StrCpy $BerthAgentProgram "${PROGRAM}"
      StrCpy $BerthWasRunning 1
    ${EndIf}
  ${EndIf}
!macroend

!macro BerthInspectInstallation CONTEXT
  StrCpy $BerthAgentProgram ""
  StrCpy $BerthLoginProgram ""
  StrCpy $BerthWasRunning 0
  StrCpy $BerthAgentStopped 0
  ; Inspect older fork installations before changing any files.
  !insertmacro BerthInspect "$INSTDIR\berth-cli.exe" "${CONTEXT}"
  !insertmacro BerthInspect "$INSTDIR\cli\berth.exe" "${CONTEXT}"
  !insertmacro BerthInspect "$INSTDIR\burf-cli.exe" "${CONTEXT}"
  !insertmacro BerthInspect "$INSTDIR\cli\burf.exe" "${CONTEXT}"
!macroend

!macro BerthDrain
  ${If} $BerthWasRunning = 1
    nsExec::ExecToStack '"$BerthAgentProgram" agent stop --drain'
    Pop $0
    Pop $1
    ${If} $0 != 0
      SetErrorLevel 1
      Abort "Burf could not stop its local agent safely. The installed files were kept."
    ${EndIf}
    StrCpy $BerthAgentStopped 1
  ${EndIf}
!macroend

!macro BerthBackup FILE DIRECTORY
  ${If} ${FileExists} "$INSTDIR\${FILE}"
    ClearErrors
    CopyFiles /SILENT "$INSTDIR\${FILE}" "${DIRECTORY}"
    ${If} ${Errors}
      SetErrorLevel 1
      Abort "Burf could not preserve the old client for recovery. The installed files were kept."
    ${EndIf}
  ${EndIf}
!macroend

; The patched maintenance page treats a normal upgrade as /UPDATE. It never
; calls the old uninstaller, so startup/PATH consent and all old files survive.
!macro NSIS_HOOK_PREINSTALL
  !insertmacro BerthInspectInstallation "install"
  InitPluginsDir
  CreateDirectory "$PLUGINSDIR\berth-rollback\cli"
  !insertmacro BerthBackup "burf-cli.exe" "$PLUGINSDIR\berth-rollback"
  !insertmacro BerthBackup "cli\burf.exe" "$PLUGINSDIR\berth-rollback\cli"
  !insertmacro BerthBackup "Burf.exe" "$PLUGINSDIR\berth-rollback"
  !insertmacro BerthBackup "berth-cli.exe" "$PLUGINSDIR\berth-rollback"
  !insertmacro BerthBackup "cli\berth.exe" "$PLUGINSDIR\berth-rollback\cli"
  !insertmacro BerthBackup "Berth.exe" "$PLUGINSDIR\berth-rollback"
  !insertmacro BerthDrain
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $BerthAgentStopped = 1
    ; Reconfigure an opted-in task with the new binary, retaining its owner.
    ${If} $BerthLoginProgram != ""
      nsExec::ExecToStack '"$BerthLoginProgram" agent install'
    ${Else}
      nsExec::ExecToStack '"$BerthAgentProgram" agent start'
    ${EndIf}
    Pop $0
    Pop $1
    ${If} $0 != 0
      SetErrorLevel 1
      Abort "Burf could not restart the updated client. Restoring the previous client."
    ${EndIf}
    StrCpy $BerthAgentStopped 0
  ${EndIf}
!macroend

!macro BerthRestore FILE
  ${If} ${FileExists} "$PLUGINSDIR\berth-rollback\${FILE}"
    System::Call 'kernel32::CopyFileW(w "$PLUGINSDIR\berth-rollback\${FILE}", w "$INSTDIR\${FILE}", i 0) i .r0'
    ${If} $0 = 0
      DetailPrint "Could not restore $INSTDIR\${FILE}"
    ${EndIf}
  ${EndIf}
!macroend

Function BerthRecover
  !insertmacro BerthRestore "berth-cli.exe"
  !insertmacro BerthRestore "cli\berth.exe"
  !insertmacro BerthRestore "Berth.exe"
  !insertmacro BerthRestore "burf-cli.exe"
  !insertmacro BerthRestore "cli\burf.exe"
  !insertmacro BerthRestore "Burf.exe"
  ${If} $BerthAgentStopped = 1
    nsExec::ExecToStack '"$BerthAgentProgram" agent start'
    Pop $0
    Pop $1
    ${If} $0 != 0
      MessageBox MB_ICONSTOP "The previous Burf client could not restart. Its state is retained; open Burf again to retry."
    ${EndIf}
    StrCpy $BerthAgentStopped 0
  ${EndIf}
FunctionEnd

Function .onInstFailed
  Call BerthRecover
FunctionEnd

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro BerthInspectInstallation "uninstall"
  !insertmacro BerthDrain
  ${If} $BerthLoginProgram != ""
    ; The correct bundled candidate owns the exact executable task identity.
    nsExec::ExecToStack '"$BerthLoginProgram" agent uninstall'
    Pop $0
    Pop $1
    ${If} $0 != 0
      ${If} $BerthAgentStopped = 1
        nsExec::ExecToStack '"$BerthAgentProgram" agent start'
        Pop $0
        Pop $1
      ${EndIf}
      SetErrorLevel 1
      Abort "Burf could not remove its owned login task. Uninstall was cancelled."
    ${EndIf}
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\Burf.exe"
    ; A headless mode of the old app uses its embedded registry command.
    nsExec::ExecToStack '"$INSTDIR\Burf.exe" --remove-cli-path'
    Pop $0
    Pop $1
    ${If} $0 != 0
      SetErrorLevel 1
      Abort "Burf could not remove its PATH entry. Uninstall was cancelled."
    ${EndIf}
  ${EndIf}
  ; Agent keys, pairing and configuration live outside the installation.
!macroend
