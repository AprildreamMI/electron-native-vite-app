# Electron Renderer-only Vite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 Vue 3 + Vite 项目改造成 Renderer-only Vite 的 Electron 模板，并提供按功能组织的 IPC API 与可操作示例页。

**Architecture:** Electron 直接运行 `electron/**/*.cjs`，Vite 只服务和构建 Renderer。Main 的生命周期、窗口创建、dotenv 加载和功能 IPC 分文件管理；Preload 暴露带白名单的通用 bridge；页面只调用 `src/apis` 中的业务函数。

**Tech Stack:** Electron、Vue 3、Vite 8、dotenv、Node.js built-in test runner、Oxlint。

---

当前目录不是 Git 仓库，因此本计划不包含 commit 步骤。

## 文件结构

- Create: `.env.development` - Main 与 Renderer 共用的非敏感开发环境变量。
- Create: `.npmrc` - Electron 和常见原生二进制的 npmmirror 下载配置。
- Modify: `package.json` - Electron 入口、启动命令、测试命令和依赖。
- Modify: `package-lock.json` - npm 安装后生成的依赖锁定。
- Modify: `vite.config.js` - 相对资源路径、固定开发端口。
- Create: `electron/env.cjs` - Vite 风格 dotenv 文件加载与 mode 解析。
- Create: `electron/window.cjs` - BrowserWindow 创建与页面加载。
- Create: `electron/main.cjs` - app 生命周期和一次性 IPC 初始化。
- Create: `electron/preload.cjs` - 自包含的 IPC 白名单 bridge。
- Create: `electron/ipc/index.cjs` - 功能 IPC 聚合注册。
- Create: `electron/ipc/user.cjs` - 用户功能 IPC。
- Create: `electron/ipc/demo.cjs` - 五种通信方式的示例 IPC。
- Create: `src/apis/user.js` - 用户业务 API。
- Create: `src/apis/demo.js` - IPC 示例业务 API。
- Create: `src/views/IpcDemoView.vue` - 可交互示例页。
- Modify: `src/router/index.js` - 默认路由指向 IPC 示例页。
- Modify: `src/App.vue` - Electron 模板应用外壳。
- Modify: `src/assets/main.css` - 示例页基础布局。
- Create: `tests/electron/env.test.cjs` - dotenv 优先级测试。
- Create: `tests/electron/ipc.test.cjs` - 功能 IPC 测试。
- Create: `tests/electron/preload.test.cjs` - preload bridge 测试。
- Create: `tests/electron/window.test.cjs` - 窗口模块测试。
- Create: `tests/renderer/apis.test.mjs` - Renderer API 测试。

### Task 1: 安装运行依赖并配置 Renderer-only 构建边界

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.js`
- Create: `.env.development`

- [ ] **Step 1: 安装 Electron 与 dotenv**

Run:

```powershell
npm install dotenv@^17.4.2
npm install --save-dev electron@^42.4.0
```

Expected: `package.json` 中 `dotenv` 位于 `dependencies`，`electron` 位于 `devDependencies`。

- [ ] **Step 2: 配置 Electron 入口和命令**

将 `package.json` 增加：

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "dev": "vite",
    "electron:dev": "electron . --mode=development",
    "electron:preview": "electron . --mode=production",
    "build": "vite build",
    "test": "node --test",
    "preview": "vite preview",
    "lint": "oxlint . --fix",
    "format": "oxfmt src/ electron/ tests/"
  }
}
```

- [ ] **Step 3: 固定 Vite 地址和生产资源路径**

在 `vite.config.js` 的配置对象中增加：

```js
base: './',
server: {
  port: 5173,
  strictPort: true,
},
```

- [ ] **Step 4: 创建共用开发环境文件**

创建 `.env.development`：

```dotenv
VITE_DEV_SERVER_URL=http://localhost:5173
VITE_ELECTRON_OPEN_DEVTOOLS=false
```

### Task 2: 通过 TDD 实现 dotenv 加载

**Files:**
- Create: `tests/electron/env.test.cjs`
- Create: `electron/env.cjs`

- [ ] **Step 1: 编写失败测试**

测试覆盖 CLI mode 解析、Vite 文件优先级和已有系统变量优先级：

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

test('解析 --mode 参数', () => {
  const { getElectronMode } = require('../../electron/env.cjs')
  assert.equal(getElectronMode(['electron', '.', '--mode=production']), 'production')
  assert.equal(getElectronMode(['electron', '.', '--mode', 'development']), 'development')
})

test('按 Vite 优先级加载环境文件且不覆盖系统变量', () => {
  const { loadElectronEnv } = require('../../electron/env.cjs')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-env-'))
  fs.writeFileSync(path.join(root, '.env'), 'VITE_TEST_VALUE=base')
  fs.writeFileSync(path.join(root, '.env.local'), 'VITE_TEST_VALUE=local')
  fs.writeFileSync(path.join(root, '.env.development'), 'VITE_TEST_VALUE=mode')
  fs.writeFileSync(path.join(root, '.env.development.local'), 'VITE_TEST_VALUE=mode-local')

  delete process.env.VITE_TEST_VALUE
  loadElectronEnv({ projectRoot: root, mode: 'development' })
  assert.equal(process.env.VITE_TEST_VALUE, 'mode-local')

  process.env.VITE_TEST_VALUE = 'system'
  loadElectronEnv({ projectRoot: root, mode: 'development' })
  assert.equal(process.env.VITE_TEST_VALUE, 'system')
  delete process.env.VITE_TEST_VALUE
  fs.rmSync(root, { recursive: true, force: true })
})
```

- [ ] **Step 2: 运行测试并确认失败原因**

Run:

```powershell
node --test tests/electron/env.test.cjs
```

Expected: FAIL，原因是 `electron/env.cjs` 不存在。

- [ ] **Step 3: 实现最小环境加载器**

`electron/env.cjs` 导出：

```js
const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')

function getElectronMode(argv = process.argv) {
  const inlineMode = argv.find((arg) => arg.startsWith('--mode='))
  if (inlineMode) return inlineMode.slice('--mode='.length)
  const modeIndex = argv.indexOf('--mode')
  return modeIndex >= 0 && argv[modeIndex + 1] ? argv[modeIndex + 1] : 'development'
}

function getEnvFiles(projectRoot, mode) {
  return [
    `.env.${mode}.local`,
    `.env.${mode}`,
    '.env.local',
    '.env',
  ].map((file) => path.join(projectRoot, file))
}

function loadElectronEnv({ projectRoot, mode }) {
  const envFiles = getEnvFiles(projectRoot, mode).filter(fs.existsSync)
  dotenv.config({ path: envFiles, quiet: true })
  return envFiles
}

function isEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

module.exports = { getElectronMode, getEnvFiles, loadElectronEnv, isEnabled }
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test tests/electron/env.test.cjs`

Expected: 2 tests passed。

### Task 3: 通过 TDD 实现按功能注册的 Main IPC

**Files:**
- Create: `tests/electron/ipc.test.cjs`
- Create: `electron/ipc/user.cjs`
- Create: `electron/ipc/demo.cjs`
- Create: `electron/ipc/index.cjs`

- [ ] **Step 1: 编写用户和 demo IPC 的失败测试**

使用记录 `handle/on` 的 fake ipcMain，验证：

```js
test('用户 IPC 完成登录、获取信息和退出状态流', async () => {
  const { createUserIpcModule, USER_CHANNELS } = require('../../electron/ipc/user.cjs')
  const handlers = new Map()
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) }
  createUserIpcModule().register(ipcMain)

  const login = await handlers.get(USER_CHANNELS.login)(null, { username: 'Ada' })
  assert.equal(login.data.user.username, 'Ada')
  assert.equal((await handlers.get(USER_CHANNELS.getInfo)()).ok, true)
  assert.equal((await handlers.get(USER_CHANNELS.logout)()).ok, true)
  assert.equal((await handlers.get(USER_CHANNELS.getInfo)()).ok, false)
})

test('demo IPC 注册 send、invoke 和 Main 推送', async () => {
  const { createDemoIpcModule, DEMO_CHANNELS } = require('../../electron/ipc/demo.cjs')
  const listeners = new Map()
  const handlers = new Map()
  const ipcMain = {
    on: (channel, handler) => listeners.set(channel, handler),
    handle: (channel, handler) => handlers.set(channel, handler),
  }
  createDemoIpcModule({ now: () => '2026-08-04T00:00:00.000Z', logger: { info() {} } }).register(ipcMain)

  const invoked = await handlers.get(DEMO_CHANNELS.invoke)(null, 'hello')
  assert.equal(invoked.data.echo, 'hello')

  const sent = []
  listeners.get(DEMO_CHANNELS.requestMessages)({
    sender: { isDestroyed: () => false, send: (...args) => sent.push(args) },
  })
  assert.equal(sent.filter(([channel]) => channel === DEMO_CHANNELS.message).length, 2)
  assert.equal(sent.filter(([channel]) => channel === DEMO_CHANNELS.onceMessage).length, 2)
})
```

- [ ] **Step 2: 运行测试并确认缺少模块**

Run: `node --test tests/electron/ipc.test.cjs`

Expected: FAIL，原因是功能 IPC 文件不存在。

- [ ] **Step 3: 实现用户 IPC**

`user.cjs` 导出 `USER_CHANNELS` 和 `createUserIpcModule()`。模块内部保存一个模拟用户，三个 `ipcMain.handle` 分别处理登录、退出和获取信息，统一返回：

```js
{ ok: boolean, message: string, data: object | null }
```

- [ ] **Step 4: 实现 demo IPC 与聚合入口**

`demo.cjs` 注册：

```js
DEMO_CHANNELS.send
DEMO_CHANNELS.invoke
DEMO_CHANNELS.requestMessages
```

`requestMessages` 向发送方各推送两次 `message` 和 `onceMessage`。`index.cjs` 创建两个模块并导出：

```js
function registerIpcHandlers(ipcMain) {
  createUserIpcModule().register(ipcMain)
  createDemoIpcModule().register(ipcMain)
}
```

- [ ] **Step 5: 运行 IPC 测试**

Run: `node --test tests/electron/ipc.test.cjs`

Expected: 2 tests passed。

### Task 4: 通过 TDD 实现 Preload 白名单 Bridge

**Files:**
- Create: `tests/electron/preload.test.cjs`
- Create: `electron/preload.cjs`

- [ ] **Step 1: 编写 VM 隔离测试**

测试使用 `node:vm` 注入 fake `contextBridge` 与 `ipcRenderer`，运行真实 preload 源码，验证：

```js
assert.equal(typeof exposed.send, 'function')
assert.equal(typeof exposed.on, 'function')
assert.equal(typeof exposed.once, 'function')
assert.equal(typeof exposed.off, 'function')
assert.equal(typeof exposed.invoke, 'function')
assert.throws(() => exposed.send('unknown:channel'), /Unknown IPC channel/)
```

同时验证允许的 channel 调用了对应 `ipcRenderer` 方法，并且 listener 原样传递，因此 Renderer 可以接收 `IpcRendererEvent`。

真实 contextBridge 会代理函数，`on` 必须返回数字订阅 ID，`off` 使用该 ID 在 Preload 内找到注册时的 listener，不能让 Renderer 再次把 listener 函数跨桥传入。

- [ ] **Step 2: 运行测试并确认 preload 缺失**

Run: `node --test tests/electron/preload.test.cjs`

Expected: FAIL，原因是 `electron/preload.cjs` 不存在。

- [ ] **Step 3: 实现自包含 Preload**

在单个文件中分别声明：

```js
const sendChannels = ['demo:send', 'demo:request-messages']
const invokeChannels = ['user:login', 'user:logout', 'user:get-info', 'demo:invoke']
const rendererChannels = ['demo:message', 'demo:once-message']
```

每个 bridge 方法先验证对应白名单，再委托给同名 `ipcRenderer` 方法。保留 Vutron 风格的 `(event, ...args)` listener 签名，并用注释说明 `IpcRendererEvent` 的权限边界。

- [ ] **Step 4: 运行 Preload 测试**

Run: `node --test tests/electron/preload.test.cjs`

Expected: preload bridge tests passed。

### Task 5: 通过 TDD 实现窗口模块

**Files:**
- Create: `tests/electron/window.test.cjs`
- Create: `electron/window.cjs`

- [ ] **Step 1: 编写失败测试**

使用 fake BrowserWindow 验证：

```js
assert.equal(options.show, false)
assert.equal(options.webPreferences.nodeIntegration, false)
assert.equal(options.webPreferences.contextIsolation, true)
assert.equal('sandbox' in options.webPreferences, false)
assert.equal(menu, null)
assert.equal(loadedUrl, 'http://localhost:5173')
```

触发 `ready-to-show` 后验证 `show()` 和 `focus()`，并分别验证生产模式使用 `loadFile()`、开发开关启用时调用 `openDevTools()`。

- [ ] **Step 2: 运行测试并确认窗口模块缺失**

Run: `node --test tests/electron/window.test.cjs`

Expected: FAIL，原因是 `electron/window.cjs` 不存在。

- [ ] **Step 3: 实现 `createMainWindow(options)`**

函数通过参数接收 `BrowserWindow`、preload 路径、Renderer 地址和 DevTools 开关，从而无需在模块内部模拟 Electron：

```js
const fs = require('node:fs')

async function createMainWindow({
  BrowserWindow,
  preloadPath,
  isDevelopment,
  devServerUrl,
  rendererEntry,
  openDevTools,
  fileExists = fs.existsSync,
}) {
  if (isDevelopment && !devServerUrl) {
    throw new Error('Missing VITE_DEV_SERVER_URL in development mode')
  }
  if (!isDevelopment && !fileExists(rendererEntry)) {
    throw new Error(`Renderer entry does not exist: ${rendererEntry}`)
  }

  const mainWindow = new BrowserWindow({
    title: 'Electron Native App',
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
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
      mainWindow.webContents.openDevTools({ mode: 'detach' })
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
```

- [ ] **Step 4: 运行窗口测试**

Run: `node --test tests/electron/window.test.cjs`

Expected: window tests passed。

### Task 6: 通过 TDD 实现 Renderer 业务 API

**Files:**
- Create: `tests/renderer/apis.test.mjs`
- Create: `src/apis/user.js`
- Create: `src/apis/demo.js`

- [ ] **Step 1: 编写失败测试**

测试创建 `globalThis.window.mainApi` fake，验证业务方法委托到正确 channel：

```js
await login({ username: 'Ada' })
assert.deepEqual(calls.invoke[0], ['user:login', { username: 'Ada' }])

sendDemoMessage('hello')
assert.deepEqual(calls.send[0], ['demo:send', 'hello'])
```

对 `onDemoMessage/offDemoMessage` 使用同一个业务 listener，验证 API 层传给 preload 的包装 listener 身份保持一致，并且包装 listener 只向页面传递 payload。

- [ ] **Step 2: 运行测试并确认 API 文件缺失**

Run: `node --test tests/renderer/apis.test.mjs`

Expected: FAIL，原因是 `src/apis/user.js` 和 `src/apis/demo.js` 不存在。

- [ ] **Step 3: 实现用户 API 与 demo API**

`user.js` 导出：

```js
export const login = (credentials) => getMainApi().invoke('user:login', credentials)
export const logout = () => getMainApi().invoke('user:logout')
export const getUserInfo = () => getMainApi().invoke('user:get-info')
```

`demo.js` 使用 `WeakMap` 保存业务 listener 与底层包装 listener 的对应关系，确保 `off` 使用注册时的同一个函数。

- [ ] **Step 4: 运行 Renderer API 测试**

Run: `node --test tests/renderer/apis.test.mjs`

Expected: renderer API tests passed。

### Task 7: 接入 Main 生命周期和 IPC 示例页

**Files:**
- Create: `electron/main.cjs`
- Create: `src/views/IpcDemoView.vue`
- Modify: `src/router/index.js`
- Modify: `src/App.vue`
- Modify: `src/assets/main.css`

- [ ] **Step 1: 实现 Main 入口**

`main.cjs` 执行顺序固定为：

```js
const mode = getElectronMode(process.argv)
loadElectronEnv({ projectRoot, mode })

app.whenReady().then(async () => {
  registerIpcHandlers(ipcMain)
  mainWindow = await openMainWindow()
})
```

`activate` 只在没有窗口时重新创建窗口，不重复注册 IPC。`window-all-closed` 在非 macOS 平台退出。

- [ ] **Step 2: 实现 IPC 示例页**

页面从 `@/apis/user` 和 `@/apis/demo` 导入方法，提供：

- 用户名输入、登录、获取用户、退出。
- send 输入与发送按钮。
- invoke 输入、调用与结果。
- on 订阅、off 取消、once 注册、触发 Main 推送。
- 时间顺序日志和 Electron API 可用状态。

页面在 `onBeforeUnmount` 中移除持续监听。

- [ ] **Step 3: 将首页路由切换为示例页并收敛默认样式**

首页加载 `IpcDemoView.vue`；`App.vue` 保留紧凑顶部导航；移除 Vue 欢迎页的双栏演示布局，建立不会在移动和桌面视口重叠的响应式网格。

- [ ] **Step 4: 运行全部自动验证**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected: tests 0 failures，lint 0 errors，Vite build exit code 0，并且 `dist` 中只有 Renderer 产物，没有 `dist/main` 或 `dist/preload`。

- [ ] **Step 5: 运行开发链路烟雾验证**

终端一：

```powershell
npm run dev
```

终端二：

```powershell
npm run electron:dev
```

Expected: Electron 窗口加载 IPC 示例页；Main/Preload 直接来自 `electron/*.cjs`；登录、退出、获取用户、send、invoke、on、once、off 均可执行。
