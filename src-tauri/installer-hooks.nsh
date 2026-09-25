!macro NSIS_HOOK_POSTINSTALL
  IfFileExists "$DESKTOP\學習地圖.lnk" 0 learning_map_desktop_done
    CreateShortcut "$DESKTOP\學習地圖.lnk" "$INSTDIR\mistake-notebook.exe" "" "$INSTDIR\learning-map-icon-0.1.41.ico" 0
    !insertmacro SetLnkAppUserModelId "$DESKTOP\學習地圖.lnk"
  learning_map_desktop_done:

  IfFileExists "$SMPROGRAMS\學習地圖.lnk" 0 learning_map_start_menu_done
    CreateShortcut "$SMPROGRAMS\學習地圖.lnk" "$INSTDIR\mistake-notebook.exe" "" "$INSTDIR\learning-map-icon-0.1.41.ico" 0
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\學習地圖.lnk"
  learning_map_start_menu_done:

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
