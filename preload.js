const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  launchWechat: function() {
    return ipcRenderer.invoke('launch-wechat');
  },
  launchApp: function(appType) {
    return ipcRenderer.invoke('launch-app', appType);
  },
  openExternal: function(url) {
    return ipcRenderer.invoke('open-external', url);
  }
});
