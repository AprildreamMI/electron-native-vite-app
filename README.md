# Electron Native App

Vue 3 + Vite + Electron 模板。Vite 只负责 Renderer，Main 和 Preload 直接运行 `electron` 目录中的原始 CommonJS 文件。

## 目录

```text
electron/
├─ main.cjs          # Electron 生命周期和一次性 IPC 注册
├─ window.cjs        # BrowserWindow 创建与页面加载
├─ env.cjs           # dotenv 环境文件加载
├─ preload.cjs       # IPC 白名单 bridge
└─ ipc/
   ├─ index.cjs      # 功能模块聚合入口
   ├─ user.cjs       # 用户功能 IPC
   └─ demo.cjs       # IPC 通信示例

src/apis/
├─ user.js           # 登录、退出、获取用户信息
└─ demo.js           # send、invoke、on、once、off
```

页面只导入业务 API：

```js
import { login, logout, getUserInfo } from '@/apis/user'
import { sendDemoMessage, invokeDemoMessage } from '@/apis/demo'
```

## 安装

```powershell
npm install
```

项目根目录的 `.npmrc` 已配置 Electron、electron-builder 和常见原生依赖的 npmmirror 下载地址。

## 开发

暂未引入进程编排工具，需要使用两个终端。

终端一启动 Renderer：

```powershell
npm run dev
```

终端二启动 Electron：

```powershell
npm run electron:dev
```

修改 Renderer 后由 Vite HMR 更新；修改 Main 或 Preload 后需要手动重启 Electron。

## 环境变量

Main 使用 dotenv，Renderer 使用 Vite，两边读取同一组环境文件。项目环境变量统一使用 `VITE_` 前缀：

```dotenv
VITE_DEV_SERVER_URL=http://localhost:5173
VITE_ELECTRON_OPEN_DEVTOOLS=false
```

`VITE_*` 会暴露给 Renderer，不能存放密钥、Token 或密码。

## 构建与预览

构建命令只生成 Renderer 的 `dist`：

```powershell
npm run build
```

使用原始 Main/Preload 加载构建产物：

```powershell
npm run electron:preview
```

## 验证

```powershell
npm test
npm run lint
npm run build
```

示例页覆盖模拟登录、退出、获取用户，以及 `send`、`invoke`、`on`、`once`、`off` 五种 IPC 操作。
