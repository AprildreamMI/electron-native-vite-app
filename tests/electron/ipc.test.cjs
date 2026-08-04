const test = require('node:test')
const assert = require('node:assert/strict')

function createFakeIpcMain() {
  const handlers = new Map()
  const listeners = new Map()

  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      },
      on(channel, listener) {
        listeners.set(channel, listener)
      },
    },
    listeners,
  }
}

test('用户 IPC 完成登录、获取信息和退出状态流', async () => {
  const {
    createUserIpcModule,
    USER_CHANNELS,
  } = require('../../electron/ipc/user.cjs')
  const { handlers, ipcMain } = createFakeIpcMain()

  createUserIpcModule().register(ipcMain)

  const emptyLogin = await handlers.get(USER_CHANNELS.login)(null, {
    username: '  ',
  })
  assert.equal(emptyLogin.ok, false)

  const login = await handlers.get(USER_CHANNELS.login)(null, {
    username: ' Ada ',
  })
  assert.equal(login.ok, true)
  assert.equal(login.data.user.username, 'Ada')

  const userInfo = await handlers.get(USER_CHANNELS.getInfo)()
  assert.deepEqual(userInfo.data.user, login.data.user)

  const logout = await handlers.get(USER_CHANNELS.logout)()
  assert.equal(logout.ok, true)
  assert.equal((await handlers.get(USER_CHANNELS.getInfo)()).ok, false)
})

test('demo IPC 注册 send 和 invoke', async () => {
  const {
    createDemoIpcModule,
    DEMO_CHANNELS,
  } = require('../../electron/ipc/demo.cjs')
  const { handlers, listeners, ipcMain } = createFakeIpcMain()
  const logs = []

  createDemoIpcModule({
    logger: { info: (...args) => logs.push(args) },
    now: () => '2026-08-04T00:00:00.000Z',
  }).register(ipcMain)

  listeners.get(DEMO_CHANNELS.send)(null, 'hello')
  assert.deepEqual(logs[0], ['[IPC demo:send]', 'hello'])

  const invoked = await handlers.get(DEMO_CHANNELS.invoke)(null, 'world')
  assert.deepEqual(invoked, {
    data: {
      echo: 'world',
      receivedAt: '2026-08-04T00:00:00.000Z',
    },
    message: 'Main 已处理 invoke 请求',
    ok: true,
  })
})

test('demo IPC 向未销毁的 Renderer 推送 on 和 once 消息', () => {
  const {
    createDemoIpcModule,
    DEMO_CHANNELS,
  } = require('../../electron/ipc/demo.cjs')
  const { listeners, ipcMain } = createFakeIpcMain()
  const sent = []

  createDemoIpcModule({
    logger: { info() {} },
    now: () => '2026-08-04T00:00:00.000Z',
  }).register(ipcMain)

  listeners.get(DEMO_CHANNELS.requestMessages)({
    sender: {
      isDestroyed: () => false,
      send: (...args) => sent.push(args),
    },
  })

  assert.equal(
    sent.filter(([channel]) => channel === DEMO_CHANNELS.message).length,
    2,
  )
  assert.equal(
    sent.filter(([channel]) => channel === DEMO_CHANNELS.onceMessage).length,
    2,
  )
  assert.deepEqual(
    sent.map(([, payload]) => payload.sequence),
    [1, 2, 1, 2],
  )
})
