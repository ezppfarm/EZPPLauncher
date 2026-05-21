!macro NSIS_HOOK_POSTINSTALL
    ${If} $PassiveMode = 1
    ${OrIf} ${Silent}
        Exec '"$INSTDIR\${MAINBINARYNAME}.exe"'
    ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
    ${If} $DeleteAppDataCheckboxState = 1
        MessageBox MB_YESNO "Do you want to remove all EZPPLauncher data and themes?" IDYES do_delete IDNO skip_delete
        do_delete:
            StrCpy $R9 1
        skip_delete:
    ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
    ${If} $R9 = 1
        RMDir /r "$PROFILE\.ezpplauncher"
    ${EndIf}
!macroend