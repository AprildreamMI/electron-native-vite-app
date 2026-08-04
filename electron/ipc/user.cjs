const USER_CHANNELS = Object.freeze({
  getInfo: 'user:get-info',
  login: 'user:login',
  logout: 'user:logout',
})

function createUserIpcModule() {
  let currentUser = null

  function register(ipcMain) {
    ipcMain.handle(USER_CHANNELS.login, (_event, credentials = {}) => {
      const username = String(credentials.username ?? '').trim()

      if (!username) {
        return {
          data: null,
          message: '请输入用户名',
          ok: false,
        }
      }

      currentUser = {
        displayName: username,
        id: 'demo-user',
        username,
      }

      return {
        data: { user: currentUser },
        message: '登录成功',
        ok: true,
      }
    })

    ipcMain.handle(USER_CHANNELS.logout, () => {
      const wasLoggedIn = currentUser !== null
      currentUser = null

      return {
        data: null,
        message: wasLoggedIn ? '退出成功' : '当前已经是退出状态',
        ok: true,
      }
    })

    ipcMain.handle(USER_CHANNELS.getInfo, () => {
      if (!currentUser) {
        return {
          data: null,
          message: '当前未登录',
          ok: false,
        }
      }

      return {
        data: { user: currentUser },
        message: '获取用户信息成功',
        ok: true,
      }
    })
  }

  return { register }
}

module.exports = {
  USER_CHANNELS,
  createUserIpcModule,
}
