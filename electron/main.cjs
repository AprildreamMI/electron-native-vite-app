const path = require('node:path')
const { app, BrowserWindow, ipcMain } = require('electron')

const {
  getElectronMode,
  isEnabled,
  loadElectronEnv,
} = require('./env.cjs')
const { registerIpcHandlers } = require('./ipc/index.cjs')
const { createMainWindow } = require('./window.cjs')

const projectRoot = path.resolve(__dirname, '..')
const mode = getElectronMode(process.argv)
const isDevelopment = mode === 'development'

loadElectronEnv({ mode, projectRoot })

let mainWindow = null

async function openMainWindow() {
  mainWindow = await createMainWindow({
    BrowserWindow,
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
    isDevelopment,
    openDevTools: isEnabled(process.env.VITE_ELECTRON_OPEN_DEVTOOLS),
    preloadPath: path.join(__dirname, 'preload.cjs'),
    rendererEntry: path.join(projectRoot, 'dist', 'index.html'),
    title: app.getName(),
  })

  return mainWindow
}

app.whenReady()
  .then(async () => {
    registerIpcHandlers(ipcMain)
    await openMainWindow()
  })
  .catch((error) => {
    console.error('Electron 启动失败:', error)
    app.quit()
  })

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await openMainWindow()
  }
})

app.on('window-all-closed', () => {
  mainWindow = null
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
