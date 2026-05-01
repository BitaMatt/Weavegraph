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
    return ipcRenderer.invoke('check-update-v2');
  },
  downloadUpdate: function() {
    return ipcRenderer.invoke('download-update-v2');
  },
  installUpdate: function() {
    return ipcRenderer.invoke('install-update-v2');
  },
  onUpdateStatus: function(callback) {
    ipcRenderer.on('update-status', (event, payload) => {
      callback(payload);
    });
  }
});
