!incluide "dotnet.nsh"

!macro NSIS_HOOK_PREINSTALL
    !insertmacro CheckDotNetCore 8.0
!macroend

!macro NSIS_HOOK_POSTINSTALL
    ${If} $PassiveMode = 1
    ${OrIf} ${Silent}
        Exec '"$INSTDIR\${MAINBINARYNAME}.exe"'
    ${EndIf}
!macroend