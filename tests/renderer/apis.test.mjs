import test from 'node:test'
import assert from 'node:assert/strict'

import { getUserInfo, login, logout } from '../../src/apis/user.js'
import {
  invokeDemoMessage,
  offDemoMessage,
  onDemoMessage,
  onceDemoMessage,
  requestMainMessages,
  sendDemoMessage,
} from '../../src/apis/demo.js'

function installMainApi() {
  const calls = {
    invoke: [],
    off: [],
    on: [],
    once: [],
    send: [],
  }

  globalThis.window = {
    mainApi: {
      invoke: async (...args) => {
        calls.invoke.push(args)
        return { args, ok: true }
      },
      off: (...args) => calls.off.push(args),
      on: (...args) => {
        calls.on.push(args)
        return 7
      },
      once: (...args) => calls.once.push(args),
      send: (...args) => calls.send.push(args),
    },
  }

  return calls
}

test('用户 API 委托到 user 功能 channel', async () => {
  const calls = installMainApi()

  await login({ username: 'Ada' })
  await getUserInfo()
  await logout()

  assert.deepEqual(calls.invoke, [
    ['user:login', { username: 'Ada' }],
    ['user:get-info'],
    ['user:logout'],
  ])
})

test('demo API 委托 send 和 invoke channel', async () => {
  const calls = installMainApi()

  sendDemoMessage('hello')
  requestMainMessages()
  await invokeDemoMessage('world')

  assert.deepEqual(calls.send, [
    ['demo:send', 'hello'],
    ['demo:request-messages'],
  ])
  assert.deepEqual(calls.invoke, [['demo:invoke', 'world']])
})

test('on/off 保持包装 listener 身份并只转交 payload', () => {
  const calls = installMainApi()
  const received = []
  const listener = (payload) => received.push(payload)

  onDemoMessage(listener)
  const wrappedListener = calls.on[0][1]
  wrappedListener({ sender: { id: 1 } }, { sequence: 1 })
  offDemoMessage(listener)

  assert.deepEqual(received, [{ sequence: 1 }])
  assert.equal(calls.on[0][0], 'demo:message')
  assert.equal(calls.off[0][0], 'demo:message')
  assert.equal(calls.off[0][1], 7)
})

test('once API 只向业务 listener 转交 payload', () => {
  const calls = installMainApi()
  const received = []

  onceDemoMessage((payload) => received.push(payload))
  calls.once[0][1]({ sender: { id: 1 } }, { sequence: 1 })

  assert.deepEqual(received, [{ sequence: 1 }])
  assert.equal(calls.once[0][0], 'demo:once-message')
})

test('普通浏览器中调用 API 返回清晰错误', async () => {
  globalThis.window = {}

  await assert.rejects(getUserInfo(), /Electron API 不可用/)
  assert.throws(() => sendDemoMessage('hello'), /Electron API 不可用/)
})
