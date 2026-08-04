# Electron Renderer-only Vite 模板设计

## 目标

在现有 Vue 3 + Vite 项目中补齐可直接运行的 Electron 开发骨架。Vite 只负责 Renderer，Electron Main 与 Preload 保持原始 CommonJS 源码运行，不引入 Main/Preload bundling。

模板需要提供一个可操作的 IPC 示例页，并采用类似前端 `apis` 目录的分层方式：页面只导入业务 API，不直接拼写 IPC channel 或访问底层 `window.mainApi`。

## 范围

本次包含：

- Electron 主进程入口、窗口生命周期与安全配置。
- 原始 `preload.cjs` 和基于 channel 白名单的 IPC bridge。
- 按功能拆分的 Main IPC 注册模块。
- Renderer 业务 API 模块。
- 用户操作和五种 IPC 方法的可交互示例页。
- dotenv 与 Vite 同名环境文件的加载。
- 双终端开发启动和 Renderer 生产构建。

本次不包含：

- `concurrently`、`wait-on`、`nodemon`、`electronmon`、`cross-env`。
- Electron 安装包、`electron-builder` 或 Forge 配置。
- Main/Preload TypeScript 编译或任何 bundling。
- 持久化用户系统或真实后端请求。

## 目录结构

```text
electron-native-app/
├─ electron/
│  ├─ main.cjs
│  ├─ window.cjs
│  ├─ preload.cjs
│  ├─ env.cjs
│  └─ ipc/
│     ├─ index.cjs
│     ├─ user.cjs
│     └─ demo.cjs
├─ src/
│  ├─ apis/
│  │  ├─ user.js
│  │  └─ demo.js
│  └─ views/
│     └─ IpcDemoView.vue
├─ tests/
│  └─ electron/
├─ .npmrc
├─ .env.development
├─ package.json
└─ vite.config.js
```

## 运行边界

`package.json.main` 直接指向 `electron/main.cjs`。`electron/**/*.cjs` 不进入 Vite 配置，也不产生对应的构建输出。

开发阶段使用两个终端：

```powershell
npm run dev
npm run electron:dev
```

第一个命令启动固定端口的 Vite dev server。第二个命令启动 Electron；Electron 执行 `main.cjs`，由 `main.cjs` 调用 `env.cjs`，读取开发服务器 URL 后创建窗口。

Renderer 生产构建仍使用：

```powershell
npm run build
```

该命令只生成 `dist`。Main 在生产模式下使用 `BrowserWindow.loadFile()` 加载 `dist/index.html`。

## 环境变量

Renderer 继续使用 Vite 内置环境变量机制，通过 `import.meta.env` 读取 `VITE_*` 变量。

Main 不经过 Vite，因此由 `env.cjs` 使用 dotenv 将同一组环境文件加载到 `process.env`。加载顺序与 Vite 的优先级保持一致：模式本地文件高于模式文件，本地文件高于基础文件，已有系统环境变量不被覆盖。

项目定义的环境变量全部使用 `VITE_` 前缀，例如：

- `VITE_DEV_SERVER_URL`：Electron 开发模式加载的 Vite 地址。
- `VITE_ELECTRON_OPEN_DEVTOOLS`：开发模式是否自动打开 DevTools。

由于 Vite 会将 `VITE_*` 变量暴露给 Renderer，这些变量只能保存非敏感配置，不能放置密钥、Token 或密码。

开发服务器地址放在 `.env.development`：

```dotenv
VITE_DEV_SERVER_URL=http://localhost:5173
```

`env.cjs` 不是独立进程，也不由 npm 直接执行。实际调用链为：

```text
npm run electron:dev
  -> electron .
  -> electron/main.cjs
  -> loadElectronEnv()
  -> createMainWindow()
```

## Main 结构

`electron/main.cjs` 只负责以下职责：

- 加载环境变量。
- 注册全部 IPC 功能模块。
- 创建主窗口。
- 根据模式加载 Vite dev server 或 `dist/index.html`。
- 处理 `activate` 和 `window-all-closed` 生命周期。

BrowserWindow 使用：

```js
{
  contextIsolation: true,
  nodeIntegration: false,
  preload: path.join(__dirname, 'preload.cjs'),
}
```

本次不显式设置 `sandbox`，避免在模板阶段引入尚未确认的沙箱行为约束。Preload 仍保持自包含单文件，不依赖项目内其他 CommonJS 模块；这样无论当前 Electron 版本的默认沙箱策略如何变化，IPC bridge 都不会依赖 preload 的本地模块加载能力。

`electron/window.cjs` 负责 BrowserWindow 的创建、开发/生产页面加载、菜单隐藏、`ready-to-show` 显示和开发 DevTools 开关。窗口创建与 Main 的应用生命周期保持分离。

窗口默认先隐藏，页面完成首屏准备后再显示：

```js
const mainWindow = new BrowserWindow({ show: false, ...options })

mainWindow.once('ready-to-show', () => {
  mainWindow.show()
})
```

默认菜单通过 `mainWindow.setMenu(null)` 隐藏。是否在启动时打开 DevTools 由 `VITE_ELECTRON_OPEN_DEVTOOLS` 控制，并且只在开发模式生效。

## 按功能注册 IPC

`electron/ipc/index.cjs` 是唯一聚合入口：

```js
function registerIpcHandlers() {
  registerUserIpcHandlers()
  registerDemoIpcHandlers()
}
```

每个功能文件管理自己的 channel、状态和 handler：

- `user.cjs`：模拟登录、退出、获取当前用户信息。
- `demo.cjs`：演示 `send`、`invoke` 以及 Main 向 Renderer 推送消息。

注册函数接收 `ipcMain` 等依赖，便于使用 Node 内置测试工具验证 channel 注册和处理结果。IPC 只在应用初始化时注册一次，避免重复注册 `ipcMain.handle`。

`registerIpcHandlers()` 只在 `app.whenReady()` 阶段调用一次。`activate` 重新创建窗口时不得再次调用，避免重复注册 `ipcMain.handle`。

## Preload Bridge

`electron/preload.cjs` 参考 Vutron，通过 `contextBridge.exposeInMainWorld('mainApi', ...)` 暴露：

```js
window.mainApi.send(channel, ...data)
const subscriptionId = window.mainApi.on(channel, listener)
window.mainApi.once(channel, listener)
window.mainApi.off(channel, subscriptionId)
window.mainApi.invoke(channel, ...data)
```

每种方法拥有独立白名单：

- `send` 只能使用 fire-and-forget channel。
- `invoke` 只能使用 request-response channel。
- `on`、`once`、`off` 只能使用 Main-to-Renderer channel。

未知 channel 立即抛出包含 channel 名称的错误，避免 Renderer 任意访问 Electron IPC。

按照已确认的要求，`on` 与 `once` 的 listener 保留 `IpcRendererEvent` 参数。代码注释会说明该对象包含 `sender` 等 Electron 上下文；底层桥允许使用，普通业务 API 默认只向页面转交业务数据。

contextBridge 会代理跨上下文传递的函数，同一个 Renderer 函数在两次 bridge 调用中不能作为可靠的 listener 身份。为保证 `off` 生效，`on` 返回数字订阅 ID，Preload 保存该 ID 对应的真实 listener，`off` 使用订阅 ID 完成移除。Renderer 的业务 API 在内部保存订阅 ID，功能页面仍然使用原始业务 listener 调用 `onDemoMessage(listener)` 和 `offDemoMessage(listener)`。

## Renderer API 层

页面和组件不能直接调用 `window.mainApi`，而是从 `src/apis` 导入业务方法：

```js
import { login, logout, getUserInfo } from '@/apis/user'
import {
  sendDemoMessage,
  invokeDemoMessage,
  onDemoMessage,
  onceDemoMessage,
  offDemoMessage,
} from '@/apis/demo'
```

`user.js` 暴露：

- `login(credentials)`
- `logout()`
- `getUserInfo()`

`demo.js` 暴露：

- `sendDemoMessage(message)`
- `invokeDemoMessage(message)`
- `requestMainMessages()`
- `onDemoMessage(listener)`
- `onceDemoMessage(listener)`
- `offDemoMessage(listener)`

API 模块统一检查 `window.mainApi` 是否存在。如果页面由普通浏览器打开，API 返回可识别错误，示例页显示 Electron API 不可用，而不是产生未捕获异常。

## IPC 示例页

`IpcDemoView.vue` 替换默认欢迎页，包含两个区域。

用户 API 区域提供：

- 用户名输入。
- 模拟登录。
- 获取当前用户信息。
- 模拟退出。
- 当前操作结果展示。

IPC 方法区域提供：

- `send`：发送无需等待结果的消息。
- `invoke`：发送消息并展示 Main 返回值。
- `on`：持续监听 Main 推送。
- `off`：使用同一个 listener 取消持续监听。
- `once`：Main 连续发送多条消息，页面只接收第一条。
- 按时间顺序展示通信日志。

示例页会在组件卸载时取消仍然存在的持续监听，防止路由切换后重复订阅。

## 错误处理

- preload 拒绝未知或方法不匹配的 channel。
- 用户未登录时，获取用户信息返回结构化失败结果。
- 重复退出保持幂等并返回明确状态。
- Renderer 捕获所有 API Promise 错误并显示在结果区域。
- Main-to-Renderer 推送前检查发送方 WebContents 尚未销毁。
- 生产模式下 `dist/index.html` 缺失时，Main 输出清晰错误并终止启动。

## 验证

使用 Node 内置测试工具验证：

- dotenv 文件优先级与模式选择。
- 用户 IPC 的注册 channel、登录、获取用户和退出状态流。
- demo IPC 的 `send` 与 `invoke` handler。
- preload 白名单的 channel 分类通过静态检查保持完整。

最终执行：

```powershell
npm test
npm run lint
npm run build
```

然后分别启动 Vite 和 Electron，人工验证示例页的五种 IPC 操作。当前阶段不要求 Main 源码热重启；修改 Main 或 Preload 后手动重启 `npm run electron:dev`。
