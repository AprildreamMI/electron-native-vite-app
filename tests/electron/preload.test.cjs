const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function loadPreload() {
  const preloadPath = path.resolve(__dirname, '../../electron/preload.cjs')
  const source = fs.readFileSync(preloadPath, 'utf8')
  const calls = {
    invoke: [],
    off: [],
    on: [],
    once: [],
    send: [],
  }
  let exposedApi

  const ipcRenderer = {
    invoke: async (...args) => {
      calls.invoke.push(args)
      return { args, ok: true }
    },
    off: (...args) => calls.off.push(args),
    on: (...args) => calls.on.push(args),
    once: (...args) => calls.once.push(args),
    send: (...args) => calls.send.push(args),
  }

  vm.runInNewContext(source, {
    console,
    require(moduleName) {
      assert.equal(moduleName, 'electron')
      return {
        contextBridge: {
          exposeInMainWorld(key, api) {
            assert.equal(key, 'mainApi')
            exposedApi = api
          },
        },
        ipcRenderer,
      }
    },
  })

  return { api: exposedApi, calls }
}

test('preload 暴露五种受白名单保护的 IPC 方法', async () => {
  const { api, calls } = loadPreload()

  assert.equal(typeof api.send, 'function')
  assert.equal(typeof api.on, 'function')
  assert.equal(typeof api.once, 'function')
  assert.equal(typeof api.off, 'function')
  assert.equal(typeof api.invoke, 'function')

  api.send('demo:send', 'hello')
  assert.deepEqual(calls.send[0], ['demo:send', 'hello'])

  const result = await api.invoke('demo:invoke', 'world')
  assert.equal(result.ok, true)
  assert.deepEqual(calls.invoke[0], ['demo:invoke', 'world'])

  assert.throws(() => api.send('unknown:channel'), /Unknown IPC channel/)
  assert.throws(() => api.invoke('demo:send'), /Unknown IPC channel/)
})

test('preload 的 on、once 和 off 保留 listener 与事件参数', () => {
  const { api, calls } = loadPreload()
  const received = []
  const listener = (event, payload) => received.push({ event, payload })

  const subscriptionId = api.on('demo:message', listener)
  api.once('demo:once-message', listener)
  api.off('demo:message', subscriptionId)

  assert.equal(typeof subscriptionId, 'number')
  assert.equal(calls.on[0][1], listener)
  assert.equal(calls.once[0][1], listener)
  assert.equal(calls.off[0][1], listener)
  assert.throws(
    () => api.off('demo:message', subscriptionId),
    /Unknown IPC subscription/,
  )

  const event = { sender: { id: 1 } }
  calls.on[0][1](event, { sequence: 1 })
  assert.equal(received[0].event, event)
  assert.deepEqual(received[0].payload, { sequence: 1 })
})
