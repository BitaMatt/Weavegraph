!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "C:\WeaveGraph"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "C:\WeaveGraph"
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "C:\WeaveGraph"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "C:\WeaveGraph"
  StrCpy $INSTDIR "C:\WeaveGraph"
!macroend

!macro customInstall
  ; 确保目标目录存在
  CreateDirectory "$INSTDIR"
  ; 强制设置安装目录
  StrCpy $INSTDIR "C:\WeaveGraph"
!macroend

!macro installationDone
  ; 强制将所有文件安装到 $INSTDIR 而不是子目录
  SetOutPath "$INSTDIR"
!macroend

!macro un.onInit
  ; 卸载初始化时询问是否删除存档
  MessageBox MB_YESNO|MB_TOPMOST|MB_SETFOREGROUND "是否删除存档数据？选择是将删除所有保存的关系网络数据，此操作不可恢复。" IDYES un.delete_data IDNO un.skip_delete

  un.delete_data:
    ; 删除 Roaming 目录中的存档数据
    SetShellVarContext current
    RMDir /r "$APPDATA\weavegraph"
    ; 删除 Local 目录中的缓存数据
    RMDir /r "$LOCALAPPDATA\WeaveGraph"

  un.skip_delete:
!macroend

!macro customUnInstall
  ; 卸载时删除程序文件
  SetShellVarContext current
  Delete "$INSTDIR\WeaveGraph.exe"
  RMDir "$INSTDIR"
  ; 清理注册表
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_UNINST_REG_KEY}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_UNINST_REG_KEY}"
!macroend
