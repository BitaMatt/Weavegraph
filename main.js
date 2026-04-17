const { app, BrowserWindow, Menu, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

let win;

function createWindow() {
  const version = app.getVersion();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'MindMapInterface v' + version,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile('index.html');
  win.setTitle('MindMapInterface v' + version);

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools();
    }
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[MAIN] Window loaded, DevTools shortcut: Ctrl+Shift+I');
  });
}

ipcMain.handle('launch-wechat', async () => {
  console.log('[MAIN] launch-wechat called');
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    console.log('[MAIN] WeChat platform:', platform);

    if (platform === 'win32') {
      console.log('[MAIN] Checking WeChat process...');
      exec('tasklist /FI "IMAGENAME eq WeChat.exe" /NH', (err, stdout) => {
        console.log('[MAIN] WeChat tasklist result - err:', err, 'stdout:', stdout);
        if (err) {
          resolve({ success: false, message: '检查微信状态失败' });
          return;
        }

        if (stdout.toLowerCase().includes('wechat.exe')) {
          console.log('[MAIN] WeChat is running, activating...');
          exec('powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate(\'WeChat\')"', (activateErr) => {
            resolve({ success: true, alreadyRunning: true, message: '微信已在运行，已聚焦窗口' });
          });
        } else {
          console.log('[MAIN] WeChat not running, searching for exe...');
          const wechatPaths = [
            path.join(process.env.LOCALAPPDATA || '', 'WeChat', 'WeChat.exe'),
            path.join(process.env.PROGRAMFILES || '', 'Tencent', 'WeChat', 'WeChat.exe'),
            path.join(process.env['PROGRAMFILES(X86)'] || '', 'Tencent', 'WeChat', 'WeChat.exe')
          ];

          let foundPath = null;
          for (const p of wechatPaths) {
            try {
              if (require('fs').existsSync(p)) {
                foundPath = p;
                break;
              }
            } catch (e) {}
          }

          if (foundPath) {
            exec(`"${foundPath}"`, (launchErr) => {
              if (launchErr) {
                resolve({ success: false, message: '启动微信失败' });
              } else {
                setTimeout(() => {
                  exec('powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate(\'WeChat\')"', () => {});
                }, 2000);
                resolve({ success: true, alreadyRunning: false, message: '已启动微信' });
              }
            });
          } else {
            exec('start weixin://', (urlErr) => {
              if (urlErr) {
                resolve({ success: false, message: '未找到微信，请安装微信' });
              } else {
                resolve({ success: true, alreadyRunning: false, message: '已通过URL启动微信' });
              }
            });
          }
        }
      });
    } else if (platform === 'darwin') {
      exec('pgrep -x WeChat', (err, stdout) => {
        if (!err && stdout.trim()) {
          exec('osascript -e \'tell application "WeChat" to activate\'', () => {
            resolve({ success: true, alreadyRunning: true, message: '微信已在运行，已聚焦窗口' });
          });
        } else {
          exec('open -a WeChat', (launchErr) => {
            if (launchErr) {
              resolve({ success: false, message: '启动微信失败' });
            } else {
              resolve({ success: true, alreadyRunning: false, message: '已启动微信' });
            }
          });
        }
      });
    } else {
      resolve({ success: false, message: '不支持的平台' });
    }
  });
});

ipcMain.handle('launch-app', async (event, appType) => {
  console.log('[MAIN] launch-app received with appType:', appType);
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    console.log('[MAIN] Platform:', platform);

    if (appType === 'qq') {
      console.log('[MAIN] Handling QQ app');
      if (platform === 'win32') {
        console.log('[MAIN] Windows platform detected, checking QQ process...');
        exec('tasklist /FI "IMAGENAME eq QQ.exe" /NH', (err, stdout) => {
          console.log('[MAIN] tasklist result - err:', err, 'stdout:', stdout);
          if (!err && stdout.toLowerCase().includes('qq.exe')) {
            console.log('[MAIN] QQ is running, focusing window...');
            
            exec('powershell -command "Get-Process QQ | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1 | Select-Object -Property Id, MainWindowTitle | ConvertTo-Json"', (err, stdout) => {
              if (err) {
                console.log('[MAIN] Failed to get QQ window info:', err);
                resolve({ success: true, message: 'QQ已在运行' });
                return;
              }
              
              console.log('[MAIN] QQ window info:', stdout);
              let qqInfo;
              try {
                qqInfo = JSON.parse(stdout);
              } catch (e) {
                console.log('[MAIN] Failed to parse QQ window info');
                resolve({ success: true, message: 'QQ已在运行' });
                return;
              }
              
              if (!qqInfo || !qqInfo.Id) {
                console.log('[MAIN] No valid QQ window found');
                resolve({ success: true, message: 'QQ已在运行' });
                return;
              }
              
              const qqPid = qqInfo.Id;
              const qqTitle = qqInfo.MainWindowTitle;
              console.log('[MAIN] QQ PID:', qqPid, 'Title:', qqTitle);
              
              const focusMethods = [
                // 方法1：使用进程ID + 最大化（唯一有效的方法）
                `powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate(${qqPid}); Start-Sleep -Milliseconds 100; Add-Type -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport(\\\"user32.dll\\\")] public static extern bool SetForegroundWindow(IntPtr hWnd);' -Name Win32 -Namespace User32 -PassThru; $h = (Get-Process -Id ${qqPid}).MainWindowHandle; if ($h -ne 0) { $w = [User32.Win32]; $w::ShowWindow($h, 3); $w::SetForegroundWindow($h) }"`
              ];
              
              let attemptIndex = 0;
              const tryNextMethod = () => {
                if (attemptIndex >= focusMethods.length) {
                  console.log('[MAIN] All QQ focus methods tried');
                  resolve({ success: true, message: 'QQ已在运行' });
                  return;
                }
                
                exec(focusMethods[attemptIndex], (activateErr) => {
                  console.log('[MAIN] QQ focus method', attemptIndex + 1, 'result:', activateErr ? 'error' : 'success');
                  attemptIndex++;
                  setTimeout(tryNextMethod, 300);
                });
              };
              
              tryNextMethod();
            });
          } else {
            console.log('[MAIN] QQ not running, trying to find and launch...');
            const qqPaths = [
              path.join(process.env.LOCALAPPDATA || '', 'Tencent', 'QQ', 'Bin', 'QQ.exe'),
              path.join(process.env.PROGRAMFILES || '', 'Tencent', 'QQ', 'Bin', 'QQ.exe'),
              path.join(process.env['PROGRAMFILES(X86)'] || '', 'Tencent', 'QQ', 'Bin', 'QQ.exe')
            ];
            let foundPath = qqPaths.find(p => { try { return require('fs').existsSync(p); } catch (e) { return false; } });
            if (foundPath) {
              exec(`"${foundPath}"`, (launchErr) => {
                if (launchErr) {
                  resolve({ success: false, message: '启动QQ失败' });
                } else {
                  setTimeout(() => {
                    exec('powershell -command "$p = Get-Process QQ | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1; if ($p) { Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) }"', () => {});
                  }, 2000);
                  resolve({ success: true, message: '已启动QQ' });
                }
              });
            } else {
              exec('start "" "tencent://"', (urlErr) => {
                if (urlErr) {
                  resolve({ success: false, message: '未找到QQ，请安装QQ' });
                } else {
                  resolve({ success: true, message: '已启动QQ' });
                }
              });
            }
          }
        });
      } else if (platform === 'darwin') {
        exec('pgrep -x QQ', (err) => {
          if (!err) {
            exec('osascript -e \'tell application "QQ" to activate\'', () => {
              resolve({ success: true, message: 'QQ已在运行，已聚焦窗口' });
            });
          } else {
            exec('open -a QQ', (launchErr) => {
              if (launchErr) {
                resolve({ success: false, message: '启动QQ失败' });
              } else {
                resolve({ success: true, message: '已启动QQ' });
              }
            });
          }
        });
      } else {
        resolve({ success: false, message: '不支持的平台' });
      }
    } else if (appType === 'email' || appType === 'mail') {
      console.log('[MAIN] Handling email app');
      if (platform === 'win32') {
        console.log('[MAIN] Windows platform detected, trying WScript.Shell method...');
        
        // 方法1：智能查找Outlook路径并启动
        const methods = [
          // 方法1：使用PowerShell查找Windows Store版Outlook
          'powershell -command "$outlookApp = Get-AppxPackage *Outlook*; if ($outlookApp) { $installLocation = $outlookApp.InstallLocation; $olkExe = Join-Path $installLocation \"olk.exe\"; if (Test-Path $olkExe) { Start-Process $olkExe } else { Start-Process mailto: } } else { Start-Process mailto: }"',
          // 方法2：使用WScript.Shell执行outlook.exe
          'powershell -command "$wsh = New-Object -ComObject WScript.Shell; $wsh.Run(\"outlook.exe\")"',
          // 方法3：使用Start-Process
          'powershell -command "Start-Process outlook.exe"',
          // 方法4：使用mailto:协议
          'powershell -command "Start-Process mailto:"',
          // 方法5：使用cmd启动
          'cmd /c "start outlook"',
          // 方法6：使用Electron shell.openExternal
          'shell'
        ];
        
        let methodIndex = 0;
        const tryNextMethod = () => {
          if (methodIndex >= methods.length) {
            console.log('[MAIN] All Outlook launch methods failed');
            resolve({ success: false, message: '启动Outlook失败，请检查是否已安装' });
            return;
          }
          
          const method = methods[methodIndex];
          console.log('[MAIN] Trying method', methodIndex + 1, ':', method);
          
          if (method === 'shell') {
            // 使用Electron的shell.openExternal
            shell.openExternal('mailto:').then(() => {
              console.log('[MAIN] shell.openExternal mailto: success');
              resolve({ success: true, message: '已打开邮件客户端' });
            }).catch((err) => {
              console.log('[MAIN] shell.openExternal mailto: failed:', err);
              methodIndex++;
              tryNextMethod();
            });
          } else {
            // 执行其他命令
            exec(method, (err) => {
              if (err) {
                console.log('[MAIN] Method', methodIndex + 1, 'failed:', err.message);
                methodIndex++;
                setTimeout(tryNextMethod, 500);
              } else {
                console.log('[MAIN] Method', methodIndex + 1, 'success');
                resolve({ success: true, message: '已打开Outlook' });
              }
            });
          }
        };
        
        tryNextMethod();
      } else if (platform === 'darwin') {
        exec('osascript -e \'tell application "Mail" to activate\'', (err) => {
          if (err) {
            exec('open -a Mail', (openErr) => {
              if (openErr) {
                resolve({ success: false, message: '启动邮件客户端失败' });
              } else {
                resolve({ success: true, message: '已启动Mail' });
              }
            });
          } else {
            resolve({ success: true, message: 'Mail已在运行，已聚焦窗口' });
          }
        });
      } else {
        resolve({ success: false, message: '不支持的平台' });
      }
    } else if (appType === 'phone') {
      console.log('[MAIN] Handling phone app');
      if (platform === 'win32') {
        console.log('[MAIN] Windows phone activation...');
        exec('powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate(\'Phone\')"', () => {
          resolve({ success: true, message: '已打开拨号应用' });
        });
      } else if (platform === 'darwin') {
        exec('open tel://', (err) => {
          if (err) {
            resolve({ success: false, message: '打开拨号失败' });
          } else {
            resolve({ success: true, message: '已打开拨号' });
          }
        });
      } else {
        resolve({ success: false, message: '不支持的平台' });
      }
    } else if (appType === 'map') {
      if (platform === 'win32') {
        exec('start "" "https://maps.google.com"', (err) => {
          if (err) {
            resolve({ success: false, message: '打开地图失败' });
          } else {
            resolve({ success: true, message: '已打开Google地图' });
          }
        });
      } else if (platform === 'darwin') {
        exec('open "https://maps.apple.com"', (err) => {
          if (err) {
            resolve({ success: false, message: '打开地图失败' });
          } else {
            resolve({ success: true, message: '已打开地图' });
          }
        });
      } else {
        resolve({ success: false, message: '不支持的平台' });
      }
    } else {
      resolve({ success: false, message: '未知的应用类型' });
    }
  });
});

ipcMain.handle('open-external', async (event, url) => {
  console.log('[MAIN] open-external received with url:', url);
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('[MAIN] open-external error:', err);
    return { success: false, message: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});