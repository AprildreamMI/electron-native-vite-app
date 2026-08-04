const onListenerMap = new WeakMap()

function getMainApi() {
  if (typeof window === 'undefined' || !window.mainApi) {
    throw new Error('Electron API 不可用，请在 Electron 窗口中执行此操作')
  }

  return window.mainApi
}

/** Send：发送后不等待结果。Example: sendDemoMessage('hello') */
export function sendDemoMessage(message) {
  getMainApi().send('demo:send', message)
}

/** Invoke：等待 Main 返回结果。Example: await invokeDemoMessage('hello') */
export async function invokeDemoMessage(message) {
  return getMainApi().invoke('demo:invoke', message)
}

/** 请求 Main 推送 on 与 once 示例消息。 */
export function requestMainMessages() {
  getMainApi().send('demo:request-messages')
}

/** On：持续订阅 Main 消息，业务 listener 只接收 payload。 */
export function onDemoMessage(listener) {
  const wrappedListener = (_event, payload) => listener(payload)
  const subscriptionId = getMainApi().on('demo:message', wrappedListener)
  onListenerMap.set(listener, subscriptionId)
  return subscriptionId
}

/** Once：只接收 Main 的第一条消息。 */
export function onceDemoMessage(listener) {
  const wrappedListener = (_event, payload) => listener(payload)
  getMainApi().once('demo:once-message', wrappedListener)
}

/** Off：使用 on 时保存的同一个包装 listener 取消订阅。 */
export function offDemoMessage(listener) {
  const subscriptionId = onListenerMap.get(listener)
  if (!subscriptionId) {
    return false
  }

  getMainApi().off('demo:message', subscriptionId)
  onListenerMap.delete(listener)
  return true
}
