const DEMO_CHANNELS = Object.freeze({
  invoke: 'demo:invoke',
  message: 'demo:message',
  onceMessage: 'demo:once-message',
  requestMessages: 'demo:request-messages',
  send: 'demo:send',
})

function createDemoIpcModule({
  now = () => new Date().toISOString(),
  logger = console,
} = {}) {
  function register(ipcMain) {
    ipcMain.on(DEMO_CHANNELS.send, (_event, message) => {
      logger.info('[IPC demo:send]', String(message ?? ''))
    })

    ipcMain.handle(DEMO_CHANNELS.invoke, (_event, message) => ({
      data: {
        echo: String(message ?? ''),
        receivedAt: now(),
      },
      message: 'Main 已处理 invoke 请求',
      ok: true,
    }))

    ipcMain.on(DEMO_CHANNELS.requestMessages, (event) => {
      if (event.sender.isDestroyed()) {
        return
      }

      const createdAt = now()
      const sendMessages = (channel, type) => {
        event.sender.send(channel, { createdAt, sequence: 1, type })
        event.sender.send(channel, { createdAt, sequence: 2, type })
      }

      sendMessages(DEMO_CHANNELS.message, 'on')
      sendMessages(DEMO_CHANNELS.onceMessage, 'once')
    })
  }

  return { register }
}

module.exports = {
  DEMO_CHANNELS,
  createDemoIpcModule,
}
