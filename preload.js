const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  launchWechat: function() {
    return ipcRenderer.invoke('launch-wechat');
  },
  launchApp: function(appType) {
    return ipcRenderer.invoke('launch-app', appType);
  },
  launchWhatsapp: function() {
    return ipcRenderer.invoke('launch-whatsapp');
  },
  openExternal: function(url) {
    return ipcRenderer.invoke('open-external', url);
  },
  onVersion: function(callback) {
    ipcRenderer.on('version', (event, version) => {
      callback(version);
    });
  },
  checkUpdate: function() {
    return ipcRenderer.invoke('check-update');
  },
  getUpdateInfo: function() {
    return ipcRenderer.invoke('get-update-info');
  },
  downloadUpdate: function() {
    return ipcRenderer.invoke('download-update');
  }
});
