function getMainApi() {
  if (typeof window === 'undefined' || !window.mainApi) {
    throw new Error('Electron API 不可用，请在 Electron 窗口中执行此操作')
  }

  return window.mainApi
}

/** 模拟登录。Example: await login({ username: 'Ada' }) */
export async function login(credentials) {
  return getMainApi().invoke('user:login', credentials)
}

/** 模拟退出。Example: await logout() */
export async function logout() {
  return getMainApi().invoke('user:logout')
}

/** 获取当前用户。Example: await getUserInfo() */
export async function getUserInfo() {
  return getMainApi().invoke('user:get-info')
}
