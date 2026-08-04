const { createUserIpcModule } = require('./user.cjs')
const { createDemoIpcModule } = require('./demo.cjs')

function registerIpcHandlers(ipcMain) {
  createUserIpcModule().register(ipcMain)
  createDemoIpcModule().register(ipcMain)
}

module.exports = { registerIpcHandlers }
