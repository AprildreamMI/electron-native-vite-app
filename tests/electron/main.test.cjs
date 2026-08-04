const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

test('Main 先加载环境并且只注册一次 IPC', async () => {
  const mainPath = path.resolve(__dirname, '../../electron/main.cjs')
  const source = fs.readFileSync(mainPath, 'utf8')
  const appListeners = new Map()
  const calls = []
  let resolveReady
  let windowCount = 0
  const readyPromise = new Promise((resolve) => {
    resolveReady = resolve
  })

  const app = {
    getName: () => 'Electron Native App',
    on: (event, listener) => appListeners.set(event, listener),
    quit: () => calls.push('quit'),
    whenReady: () => readyPromise,
  }
  const BrowserWindow = {
    getAllWindows: () => (windowCount > 0 ? [{}] : []),
  }

  vm.runInNewContext(source, {
    __dirname: path.dirname(mainPath),
    console,
    process: {
      argv: ['electron', '.', '--mode=development'],
      env: {
        VITE_DEV_SERVER_URL: 'http://localhost:5173',
        VITE_ELECTRON_OPEN_DEVTOOLS: 'false',
      },
      platform: 'win32',
    },
    require(moduleName) {
      if (moduleName === 'node:path') {return path}
      if (moduleName === 'electron') {return { BrowserWindow, app, ipcMain: {} }}
      if (moduleName === './env.cjs') {
        return {
          getElectronMode: () => 'development',
          isEnabled: () => false,
          loadElectronEnv: () => calls.push('load-env'),
        }
      }
      if (moduleName === './window.cjs') {
        return {
          createMainWindow: async () => {
            calls.push('create-window')
            windowCount += 1
            return {}
          },
        }
      }
      if (moduleName === './ipc/index.cjs') {
        return { registerIpcHandlers: () => calls.push('register-ipc') }
      }
      throw new Error(`Unexpected module: ${moduleName}`)
    },
  })

  assert.deepEqual(calls, ['load-env'])
  resolveReady()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ['load-env', 'register-ipc', 'create-window'])

  windowCount = 0
  await appListeners.get('activate')()
  assert.deepEqual(calls, [
    'load-env',
    'register-ipc',
    'create-window',
    'create-window',
  ])

  appListeners.get('window-all-closed')()
  assert.equal(calls.at(-1), 'quit')
})
