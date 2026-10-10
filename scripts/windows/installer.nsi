Unicode true
!include MUI2.nsh
!include LogicLib.nsh
!include StrFunc.nsh
${StrLoc}
!define VERSION "@VERSION@"
!define STAGE "@STAGE@"
!include "@HOOKS@"
Name "Burf"
OutFile "@OUTPUT@"
InstallDir "$LOCALAPPDATA\Burf"
InstallDirRegKey HKCU "Software\berth\Burf" ""
RequestExecutionLevel user
SetCompressor /SOLID lzma
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "Burf"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "FileDescription" "Burf @ARCH@ installer"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Copyright Burf contributors"
!define MUI_ICON "@ICON@"
!define MUI_UNICON "@ICON@"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  SetShellVarContext current
  System::Call 'shell32::IsUserAnAdmin() i .r0'
  ${If} $0 != 0
    SetErrorLevel 1
    Abort "Run the Burf installer as the ordinary login user, without elevation."
  ${EndIf}
  ; Reuse the existing Evergreen runtime. Never install a prerequisite silently.
  SetRegView 64
  ReadRegStr $0 HKLM "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $0 == ""
    SetRegView 32
    ReadRegStr $0 HKLM "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  SetRegView 64
  ${If} $0 == ""
    SetErrorLevel 1
    Abort "Burf requires the existing Microsoft Edge WebView2 Evergreen runtime. Install it with your approval, then retry."
  ${EndIf}
FunctionEnd

Function un.onInit
  SetShellVarContext current
  SetRegView 64
  System::Call 'shell32::IsUserAnAdmin() i .r0'
  ${If} $0 != 0
    SetErrorLevel 1
    Abort "Run the Burf uninstaller as the ordinary login user, without elevation."
  ${EndIf}
FunctionEnd

!macro InstallFile NAME
  ClearErrors
  File "${STAGE}\${NAME}"
  ${If} ${Errors}
    SetErrorLevel 1
    Abort "Burf could not replace ${NAME}. Close the Burf window and retry; the previous client will be restored."
  ${EndIf}
!macroend

Section "Burf"
  ; Overinstall never invokes the previous uninstaller or changes opt-in consent.
  ReadRegStr $0 HKCU "Software\Classes\berth\shell\open\command" ""
  ${If} $0 != ""
  ${AndIf} $0 != '$\"$INSTDIR\Burf.exe$\" $\"%1$\"'
  ${AndIf} $0 != '$\"$INSTDIR\Berth.exe$\" $\"%1$\"'
    SetErrorLevel 1
    Abort "The berth URL scheme belongs to another installation. Its registration was kept."
  ${EndIf}
  !insertmacro NSIS_HOOK_PREINSTALL
  SetOverwrite on
  SetOutPath "$INSTDIR"
  !insertmacro InstallFile "Burf.exe"
  !insertmacro InstallFile "berth-cli.exe"
  !insertmacro InstallFile "burf-cli.exe"
  !insertmacro InstallFile "WebView2Loader.dll"
  !insertmacro InstallFile "WebView2-LICENSE.txt"
  !insertmacro InstallFile "WebView2-NOTICE.txt"
  !insertmacro InstallFile "LICENSE.txt"
  !insertmacro InstallFile "berthd-linux-amd64"
  !insertmacro InstallFile "berthd-linux-arm64"
  File /nonfatal "${STAGE}\tmux-linux-amd64"
  File /nonfatal "${STAGE}\tmux-linux-arm64"
  SetOutPath "$INSTDIR\cli"
  !insertmacro InstallFile "cli\burf.exe"
  !insertmacro InstallFile "cli\berth.exe"
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  !insertmacro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\berth\Burf" "" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "DisplayName" "Burf"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "Publisher" "Myles Cook"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "DisplayIcon" "$INSTDIR\Burf.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "UninstallString" '$\"$INSTDIR\uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "QuietUninstallString" '$\"$INSTDIR\uninstall.exe$\" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "NoRepair" 1
  WriteRegStr HKCU "Software\Classes\berth" "" "URL:Berth Protocol"
  WriteRegStr HKCU "Software\Classes\berth" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\berth\shell\open\command" "" '$\"$INSTDIR\Burf.exe$\" $\"%1$\"'
  CreateShortcut "$SMPROGRAMS\Burf.lnk" "$INSTDIR\Burf.exe"
SectionEnd

Section "Uninstall"
  !insertmacro NSIS_HOOK_PREUNINSTALL
  ReadRegStr $0 HKCU "Software\Classes\berth\shell\open\command" ""
  ${If} $0 == '$\"$INSTDIR\Burf.exe$\" $\"%1$\"'
    DeleteRegKey HKCU "Software\Classes\berth"
  ${EndIf}
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf" "InstallLocation"
  ${If} $0 == "$INSTDIR"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Burf"
  ${EndIf}
  Delete "$SMPROGRAMS\Burf.lnk"
  Delete "$INSTDIR\Burf.exe"
  Delete "$INSTDIR\Berth.exe"
  Delete "$INSTDIR\burf-cli.exe"
  Delete "$INSTDIR\berth-cli.exe"
  Delete "$INSTDIR\cli\burf.exe"
  Delete "$INSTDIR\cli\berth.exe"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\WebView2-LICENSE.txt"
  Delete "$INSTDIR\WebView2-NOTICE.txt"
  Delete "$INSTDIR\LICENSE.txt"
  Delete "$INSTDIR\berthd-linux-amd64"
  Delete "$INSTDIR\berthd-linux-arm64"
  Delete "$INSTDIR\tmux-linux-amd64"
  Delete "$INSTDIR\tmux-linux-arm64"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR\cli"
  RMDir "$INSTDIR"
  ; Retain the legacy install-location preference and all user state.
SectionEnd
