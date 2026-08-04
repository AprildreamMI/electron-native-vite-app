const { contextBridge, ipcRenderer } = require('electron')

// Renderer -> Main，无返回值的 fire-and-forget 通信。
const sendChannels = ['demo:send', 'demo:request-messages']

// Renderer -> Main -> Renderer，需要等待返回值的 request-response 通信。
const invokeChannels = [
  'user:login',
  'user:logout',
  'user:get-info',
  'demo:invoke',
]

// Main -> Renderer，由 Renderer 使用 on、once 和 off 管理订阅。
const rendererChannels = ['demo:message', 'demo:once-message']
const subscriptions = new Map()
let nextSubscriptionId = 1

function assertAllowed(method, channel, availableChannels) {
  if (!availableChannels.includes(channel)) {
    throw new Error(`Unknown IPC channel for ${method}: ${channel}`)
  }
}

contextBridge.exposeInMainWorld('mainApi', {
  // 发送后不等待 Main 返回值。
  // Example: window.mainApi.send('demo:send', 'hello')
  send(channel, ...data) {
    assertAllowed('send', channel, sendChannels)
    ipcRenderer.send(channel, ...data)
  },

  // 持续监听 Main 推送，并返回可跨 contextBridge 使用的数字订阅 ID。
  // Example: const id = window.mainApi.on('demo:message', listener)
  on(channel, listener) {
    assertAllowed('on', channel, rendererChannels)
    ipcRenderer.on(channel, listener)
    const subscriptionId = nextSubscriptionId
    nextSubscriptionId += 1
    subscriptions.set(subscriptionId, { channel, listener })
    return subscriptionId
  },

  // 只接收 Main 第一次推送，触发后 Electron 自动移除监听。
  // Example: window.mainApi.once('demo:once-message', listener)
  once(channel, listener) {
    assertAllowed('once', channel, rendererChannels)
    ipcRenderer.once(channel, listener)
  },

  // 使用 on 返回的 ID 取消持续监听，避免函数再次跨 contextBridge 后身份变化。
  // Example: window.mainApi.off('demo:message', subscriptionId)
  off(channel, subscriptionId) {
    assertAllowed('off', channel, rendererChannels)
    const subscription = subscriptions.get(subscriptionId)
    if (!subscription || subscription.channel !== channel) {
      throw new Error(`Unknown IPC subscription for ${channel}: ${subscriptionId}`)
    }

    ipcRenderer.off(channel, subscription.listener)
    subscriptions.delete(subscriptionId)
  },

  // 等待 Main handler 返回结果或抛出错误。
  // Example: await window.mainApi.invoke('demo:invoke', 'hello')
  invoke(channel, ...data) {
    assertAllowed('invoke', channel, invokeChannels)
    return ipcRenderer.invoke(channel, ...data)
  },
})

// On/once 的 listener 会收到 IpcRendererEvent。该对象包含 sender 等 Electron
// 上下文，业务 API 应只在确有需要时使用，并优先向页面转交普通业务数据。
