const test = require('node:test')
const assert = require('node:assert/strict')

function createBrowserWindowHarness() {
  let instance

  class FakeBrowserWindow {
    constructor(options) {
      this.options = options
      this.windowListeners = new Map()
      this.webContentsListeners = new Map()
      this.menu = undefined
      this.loadedUrl = null
      this.loadedFile = null
      this.shown = false
      this.focused = false
      this.devToolsOptions = null
      this.webContents = {
        once: (event, listener) => this.webContentsListeners.set(event, listener),
        openDevTools: (options) => {
          this.devToolsOptions = options
        },
      }
      instance = this
    }

    setMenu(menu) {
      this.menu = menu
    }

    once(event, listener) {
      this.windowListeners.set(event, listener)
    }

    isDestroyed() {
      return false
    }

    show() {
      this.shown = true
    }

    focus() {
      this.focused = true
    }

    async loadURL(url) {
      this.loadedUrl = url
    }

    async loadFile(file) {
      this.loadedFile = file
    }
  }

  return {
    BrowserWindow: FakeBrowserWindow,
    getInstance: () => instance,
  }
}

test('开发模式创建安全窗口并在 ready-to-show 后显示', async () => {
  const { createMainWindow } = require('../../electron/window.cjs')
  const harness = createBrowserWindowHarness()

  const result = await createMainWindow({
    BrowserWindow: harness.BrowserWindow,
    devServerUrl: 'http://localhost:5173',
    isDevelopment: true,
    openDevTools: true,
    preloadPath: 'D:/app/electron/preload.cjs',
    rendererEntry: 'D:/app/dist/index.html',
  })
  const window = harness.getInstance()

  assert.equal(result, window)
  assert.equal(window.options.show, false)
  assert.equal(window.options.webPreferences.nodeIntegration, false)
  assert.equal(window.options.webPreferences.contextIsolation, true)
  assert.equal('sandbox' in window.options.webPreferences, false)
  assert.equal(window.menu, null)
  assert.equal(window.loadedUrl, 'http://localhost:5173')

  window.windowListeners.get('ready-to-show')()
  assert.equal(window.shown, true)
  assert.equal(window.focused, true)

  window.webContentsListeners.get('did-frame-finish-load')()
  assert.deepEqual(window.devToolsOptions, { mode: 'detach' })
})

test('生产模式加载 Renderer 构建文件且不注册 DevTools listener', async () => {
  const { createMainWindow } = require('../../electron/window.cjs')
  const harness = createBrowserWindowHarness()

  await createMainWindow({
    BrowserWindow: harness.BrowserWindow,
    devServerUrl: undefined,
    fileExists: () => true,
    isDevelopment: false,
    openDevTools: false,
    preloadPath: 'D:/app/electron/preload.cjs',
    rendererEntry: 'D:/app/dist/index.html',
  })
  const window = harness.getInstance()

  assert.equal(window.loadedFile, 'D:/app/dist/index.html')
  assert.equal(window.loadedUrl, null)
  assert.equal(window.webContentsListeners.has('did-frame-finish-load'), false)
})

test('开发模式缺少 VITE_DEV_SERVER_URL 时给出明确错误', async () => {
  const { createMainWindow } = require('../../electron/window.cjs')
  const harness = createBrowserWindowHarness()

  await assert.rejects(
    createMainWindow({
      BrowserWindow: harness.BrowserWindow,
      devServerUrl: '',
      isDevelopment: true,
      openDevTools: false,
      preloadPath: 'D:/app/electron/preload.cjs',
      rendererEntry: 'D:/app/dist/index.html',
    }),
    /VITE_DEV_SERVER_URL/,
  )
})
