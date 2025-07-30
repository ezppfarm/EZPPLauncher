!macro NSIS_HOOK_POSTINSTALL
    ${If} $PassiveMode = 1
    ${OrIf} ${Silent}
        Exec '"$INSTDIR\${MAINBINARYNAME}.exe"'
    ${EndIf}
!macroend