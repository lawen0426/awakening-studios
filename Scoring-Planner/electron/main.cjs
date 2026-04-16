const { app, BrowserWindow, Menu, dialog } = require('electron')
const fs = require('fs')
const path = require('path')
const { autoUpdater } = require('electron-updater')

let mainWindow = null
let hasAttachedAutoUpdaterListeners = false
let isManualUpdateCheck = false

function readAutoUpdateConfig() {
  const configPath = path.join(__dirname, 'github-release.json')
  const defaults = {
    owner: '',
    repo: '',
    releaseType: 'release',
  }

  try {
    if (!fs.existsSync(configPath)) {
      return defaults
    }

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    return {
      owner: process.env.GH_RELEASE_OWNER || parsed.owner || defaults.owner,
      repo: process.env.GH_RELEASE_REPO || parsed.repo || defaults.repo,
      releaseType: process.env.GH_RELEASE_TYPE || parsed.releaseType || defaults.releaseType,
    }
  } catch (error) {
    console.warn('[auto-update] Failed to read config:', error)
    return defaults
  }
}

function showMessage(title, message) {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined
  return dialog.showMessageBox(targetWindow, {
    type: 'info',
    title,
    message,
  })
}

function showError(title, message) {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined
  return dialog.showMessageBox(targetWindow, {
    type: 'error',
    title,
    message,
  })
}

function attachAutoUpdaterListeners() {
  if (hasAttachedAutoUpdaterListeners) {
    return
  }

  hasAttachedAutoUpdaterListeners = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[auto-update] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[auto-update] Update available:', info.version)
    if (isManualUpdateCheck) {
      void showMessage(
        'Update Found',
        `Version ${info.version} is available. The update is downloading in the background.`,
      )
      isManualUpdateCheck = false
    }
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[auto-update] No update available.')
    if (isManualUpdateCheck) {
      void showMessage(
        'Up to Date',
        `You already have the latest version (${info.version ?? app.getVersion()}).`,
      )
      isManualUpdateCheck = false
    }
  })

  autoUpdater.on('error', (error) => {
    console.error('[auto-update] Error:', error)
    if (isManualUpdateCheck) {
      void showError(
        'Update Failed',
        error?.message || 'The app could not check for updates.',
      )
      isManualUpdateCheck = false
    }
  })

  autoUpdater.on('update-downloaded', async (info) => {
    console.log('[auto-update] Update downloaded:', info.version)
    const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined
    const result = await dialog.showMessageBox(targetWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded and is ready to install.`,
      detail: 'Choose Install Now to quit the app and finish the update.',
      buttons: ['Install Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })

    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })
}

async function checkForUpdates(options = {}) {
  const { manual = false } = options

  if (!app.isPackaged) {
    if (manual) {
      await showMessage(
        'Updates Disabled in Development',
        'Auto-update checks only run in packaged builds.',
      )
    }
    return
  }

  const config = readAutoUpdateConfig()
  if (!config.owner || !config.repo) {
    if (manual) {
      await showError(
        'GitHub Releases Missing',
        'Set electron/github-release.json or GH_RELEASE_OWNER / GH_RELEASE_REPO before using auto updates.',
      )
    }
    return
  }

  attachAutoUpdaterListeners()
  isManualUpdateCheck = manual
  await autoUpdater.checkForUpdates()
}

function createApplicationMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Check for Updates…',
                click: () => {
                  void checkForUpdates({ manual: true })
                },
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Check for Updates…',
          click: () => {
            void checkForUpdates({ manual: true })
          },
        },
        ...(process.platform === 'darwin' ? [] : [{ type: 'separator' }, { role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1080,
    minWidth: 1200,
    minHeight: 900,
    show: false,
    backgroundColor: '#111111',
    title: 'Awakening Studios',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devServerUrl = process.env.ELECTRON_START_URL

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createApplicationMenu()
  createWindow()
  void checkForUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
