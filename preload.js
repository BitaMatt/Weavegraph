const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    sendMessage: (message) => ipcRenderer.send('message', message),
    onResponse: (callback) => ipcRenderer.on('response', (event, ...args) => callback(...args)),
    fs: {
      writeFileSync: (filePath, data) => fs.writeFileSync(filePath, data),
      readFileSync: (filePath) => fs.readFileSync(filePath, 'utf8'),
      existsSync: (path) => fs.existsSync(path),
      mkdirSync: (path, options) => fs.mkdirSync(path, options)
    },
    path: {
      join: (...args) => path.join(...args),
      dirname: (path) => path.dirname(path),
      resolve: (...args) => path.resolve(...args)
    }
  }
);