!macro customInstall
  WriteRegStr HKCU "Software\Classes\LocalMD.Markdown" "" "Markdown document"
  WriteRegStr HKCU "Software\Classes\LocalMD.Markdown\DefaultIcon" "" '"$INSTDIR\LocalMD.exe",0'
  WriteRegStr HKCU "Software\Classes\LocalMD.Markdown\shell\open\command" "" '"$INSTDIR\LocalMD.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\.md\OpenWithProgids" "LocalMD.Markdown" ""
  WriteRegStr HKCU "Software\Classes\.markdown\OpenWithProgids" "LocalMD.Markdown" ""
  WriteRegStr HKCU "Software\Classes\Applications\LocalMD.exe" "FriendlyAppName" "LocalMD"
  WriteRegStr HKCU "Software\Classes\Applications\LocalMD.exe\shell\open\command" "" '"$INSTDIR\LocalMD.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Applications\LocalMD.exe\SupportedTypes" ".md" ""
  WriteRegStr HKCU "Software\Classes\Applications\LocalMD.exe\SupportedTypes" ".markdown" ""
!macroend
!macro customUnInstall
  DeleteRegValue HKCU "Software\Classes\.md\OpenWithProgids" "LocalMD.Markdown"
  DeleteRegValue HKCU "Software\Classes\.markdown\OpenWithProgids" "LocalMD.Markdown"
  DeleteRegKey HKCU "Software\Classes\LocalMD.Markdown"
  DeleteRegKey HKCU "Software\Classes\Applications\LocalMD.exe"
!macroend
