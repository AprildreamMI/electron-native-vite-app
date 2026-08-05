const fs = require('node:fs')

async function createMainWindow({
  BrowserWindow,
  preloadPath,
  isDevelopment,
  devServerUrl,
  rendererEntry,
  openDevTools = false,
  title = 'Electron Native App',
  fileExists = fs.existsSync,
}) {
  if (isDevelopment && !devServerUrl) {
    throw new Error('Missing VITE_DEV_SERVER_URL in development mode')
  }

  if (!isDevelopment && !fileExists(rendererEntry)) {
    throw new Error(`Renderer entry does not exist: ${rendererEntry}`)
  }

  const mainWindow = new BrowserWindow({
    height: 800,
    show: false,
    title,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
    width: 1200,
  })

  mainWindow.setMenu(null)
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  if (isDevelopment && openDevTools) {
    mainWindow.webContents.once('did-frame-finish-load', () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools({ mode: 'right' })
      }
    })
  }

  if (isDevelopment) {
    await mainWindow.loadURL(devServerUrl)
  } else {
    await mainWindow.loadFile(rendererEntry)
  }

  return mainWindow
}

module.exports = { createMainWindow }
