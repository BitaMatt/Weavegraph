const { app, BrowserWindow, Menu, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https');
const http = require('http');

let win;
let splashWindow;
let updateInfo = null;

// GitHub 配置 - 请修改为您的仓库信息
const GITHUB_OWNER = 'BitaMatt';
const GITHUB_REPO = 'Weavegraph';

// 版本比较函数
function compareVersions(current, latest) {
  const currentParts = current.replace(/^v/, '').split('.').map(Number);
  const latestParts = latest.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const a = currentParts[i] || 0;
    const b = latestParts[i] || 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

// 获取最新的 GitHub Release 信息（包含assets）
function getLatestReleaseWithAssets() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'WeaveGraph-AutoUpdate'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const exeAsset = release.assets && release.assets.find(asset =>
            asset.name && asset.name.endsWith('.exe')
          );
          resolve({
            version: release.tag_name || release.name,
            downloadUrl: release.html_url,
            body: release.body || '',
            assets: release.assets || [],
            exeDownloadUrl: exeAsset ? exeAsset.browser_download_url : null,
            exeAssetName: exeAsset ? exeAsset.name : null
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 获取最新的 GitHub Release 信息
function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'WeaveGraph-AutoUpdate'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          resolve({
            version: release.tag_name || release.name,
            downloadUrl: release.html_url,
            body: release.body || ''
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 检查更新的函数
async function checkForUpdate() {
  try {
    const currentVersion = app.getVersion();
    console.log('[MAIN] Current version:', currentVersion);

    const release = await getLatestReleaseWithAssets();
    console.log('[MAIN] Latest release:', release);

    const comparison = compareVersions(currentVersion, release.version);
    console.log('[MAIN] Version comparison result:', comparison);

    if (comparison < 0) {
      // 发现新版本
      updateInfo = {
        currentVersion: currentVersion,
        latestVersion: release.version,
        downloadUrl: release.downloadUrl,
        releaseNotes: release.body,
        exeDownloadUrl: release.exeDownloadUrl,
        exeAssetName: release.exeAssetName
      };
      console.log('[MAIN] New version available:', updateInfo);
      return updateInfo;
    }
    return null;
  } catch (e) {
    console.log('[MAIN] Update check failed:', e.message);
    return null;
  }
}

// 下载文件到临时目录
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // 重定向
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // 删除失败的文件
      reject(err);
    });
  });
}

function getPackageInfo() {
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log("packageData.author:",packageData.author)
    console.log("packageData.version:",packageData.version)
    return {
      author: packageData.author || '曹振威',
      version: packageData.version || '1.0.0',
      buildDate: process.env.BUILD_DATE || new Date().toISOString().split('T')[0]
    };
  } catch (e) {
    console.log("getPackageInfo error:",e)
    return {
      author: '曹振威',
      version: '1.0.0',
      buildDate: new Date().toISOString().split('T')[0]
    };
  }
}

function createSplashWindow() {
  const packageInfo = getPackageInfo();
  console.log('[MAIN] Package info for splash:', packageInfo);
  console.log('[MAIN] __dirname:', __dirname);
  console.log('[MAIN] app.isPackaged:', app.isPackaged);

  const splashPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'splash.html')
    : path.join(__dirname, 'splash.html');
  console.log('[MAIN] Splash path:', splashPath);

  splashWindow = new BrowserWindow({
    width: 500,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadFile(splashPath);

  splashWindow.webContents.on('did-finish-load', () => {
    console.log('[MAIN] Splash window loaded, sending package info');
    splashWindow.webContents.send('package-info', packageInfo);
  });

  splashWindow.on('closed', function () {
    splashWindow = null;
  });
}

function createWindow() {
  const version = app.getVersion();

  let iconPath;
  if (app.isPackaged) {
    iconPath = path.join(process.resourcesPath, 'app.asar', 'icon', 'logo.png');
  } else {
    iconPath = path.join(__dirname, 'icon', 'logo.png');
  }
  console.log('[MAIN] Icon path:', iconPath);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: '人脈織圖 (WeaveGraph) v' + version,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  Menu.setApplicationMenu(null);
  win.loadFile('index.html');

  // 立即发送版本信息给渲染进程，让它可以提前加载翻译
  win.webContents.on('did-finish-load', () => {
    console.log('[MAIN] Window content loaded, sending version:', version);
    win.setTitle('人脈織圖 (WeaveGraph) v' + version);
    win.webContents.send('version', version);

    // 通知splash窗口翻译已加载完成
    console.log('[MAIN] Checking splashWindow:', splashWindow);
    if (splashWindow && splashWindow.webContents) {
      console.log('[MAIN] Notifying splash window that translation is ready');
      splashWindow.webContents.send('translation-ready');
    } else {
      console.log('[MAIN] splashWindow not available or webContents not ready');
    }
  });

  // 处理splash窗口的enter-app消息
  ipcMain.on('enter-app', () => {
    if (splashWindow) {
      splashWindow.close();
    }
    win.show();
  });

  win.on('ready-to-show', function () {
    // 不再自动关闭splash窗口，由splash窗口发送消息来控制
  });

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools();
    }
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

ipcMain.handle('launch-whatsapp', async () => {
  console.log('[MAIN] launch-whatsapp called');
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    console.log('[MAIN] WhatsApp platform:', platform);

    if (platform === 'win32') {
      console.log('[MAIN] Checking WhatsApp process...');
      exec('tasklist /FI "IMAGENAME eq WhatsApp.exe" /NH', (err, stdout) => {
        console.log('[MAIN] WhatsApp tasklist result - err:', err, 'stdout:', stdout);
        if (err) {
          resolve({ success: false, message: '检查WhatsApp状态失败' });
          return;
        }

        if (stdout.toLowerCase().includes('whatsapp.exe')) {
          console.log('[MAIN] WhatsApp is running, activating...');
          exec('powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate(\'WhatsApp\')"', (activateErr) => {
            resolve({ success: true, alreadyRunning: true, message: 'WhatsApp已在运行，已聚焦窗口' });
          });
        } else {
          console.log('[MAIN] WhatsApp not running, searching for exe...');
          const whatsappPaths = [
            path.join(process.env.LOCALAPPDATA || '', 'WhatsApp', 'WhatsApp.exe'),
            path.join(process.env.PROGRAMFILES || '', 'WhatsApp', 'WhatsApp.exe'),
            path.join(process.env['PROGRAMFILES(X86)'] || '', 'WhatsApp', 'WhatsApp.exe')
          ];

          let foundPath = null;
          for (const p of whatsappPaths) {
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
                resolve({ success: false, message: '启动WhatsApp失败' });
              } else {
                setTimeout(() => {
                  exec('powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate(\'WhatsApp\')"', () => {});
                }, 2000);
                resolve({ success: true, alreadyRunning: false, message: '已启动WhatsApp' });
              }
            });
          } else {
            exec('start whatsapp://', (urlErr) => {
              if (urlErr) {
                resolve({ success: false, message: '未找到WhatsApp，请安装WhatsApp' });
              } else {
                resolve({ success: true, alreadyRunning: false, message: '已通过URL启动WhatsApp' });
              }
            });
          }
        }
      });
    } else if (platform === 'darwin') {
      exec('pgrep -x WhatsApp', (err, stdout) => {
        if (!err && stdout.trim()) {
          exec('osascript -e \'tell application "WhatsApp" to activate\'', () => {
            resolve({ success: true, alreadyRunning: true, message: 'WhatsApp已在运行，已聚焦窗口' });
          });
        } else {
          exec('open -a WhatsApp', (launchErr) => {
            if (launchErr) {
              resolve({ success: false, message: '启动WhatsApp失败' });
            } else {
              resolve({ success: true, alreadyRunning: false, message: '已启动WhatsApp' });
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

// 检查更新
ipcMain.handle('check-update', async () => {
  console.log('[MAIN] check-update called');
  try {
    const result = await checkForUpdate();
    return { hasUpdate: result !== null, info: result };
  } catch (e) {
    console.error('[MAIN] check-update error:', e);
    return { hasUpdate: false, error: e.message };
  }
});

// 获取更新信息
ipcMain.handle('get-update-info', async () => {
  return updateInfo;
});

// 下载并安装更新
ipcMain.handle('download-update', async (event) => {
  console.log('[MAIN] download-update called');
  if (!updateInfo || !updateInfo.exeDownloadUrl) {
    return { success: false, message: 'No update available or no download URL' };
  }

  try {
    const downloadUrl = updateInfo.exeDownloadUrl;
    const tempDir = app.getPath('temp');
    const exeFileName = updateInfo.exeAssetName || `WeaveGraph-Update-${updateInfo.latestVersion}.exe`;
    const destPath = path.join(tempDir, exeFileName);

    console.log('[MAIN] Downloading update from:', downloadUrl);
    console.log('[MAIN] Saving to:', destPath);

    // 下载文件
    await downloadFile(downloadUrl, destPath);
    console.log('[MAIN] Download complete, running installer...');

    // 运行安装程序
    exec(`"${destPath}"`, (err) => {
      if (err) {
        console.error('[MAIN] Failed to run installer:', err);
        return { success: false, message: err.message };
      }
      console.log('[MAIN] Installer started successfully');
      // 退出当前应用，让安装程序可以更新
      app.quit();
    });

    return { success: true, message: 'Download complete, installing...' };
  } catch (e) {
    console.error('[MAIN] download-update error:', e);
    return { success: false, message: e.message };
  }
});

app.whenReady().then(() => {
  createSplashWindow();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});