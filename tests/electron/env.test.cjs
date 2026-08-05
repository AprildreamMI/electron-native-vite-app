const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

test('解析 Electron 的 --mode 参数', () => {
  const { getElectronMode } = require('../../electron/env.cjs')

  assert.equal(
    getElectronMode(['electron', '.', '--mode=production']),
    'production',
  )
  assert.equal(
    getElectronMode(['electron', '.', '--mode', 'development']),
    'development',
  )
  assert.equal(getElectronMode(['electron', '.']), 'development')
})

test('按 Vite 优先级加载环境文件', () => {
  const { loadElectronEnv } = require('../../electron/env.cjs')
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-env-'))

  try {
    fs.writeFileSync(path.join(projectRoot, '.env'), 'VITE_TEST_VALUE=base')
    fs.writeFileSync(
      path.join(projectRoot, '.env.local'),
      'VITE_TEST_VALUE=local',
    )
    fs.writeFileSync(
      path.join(projectRoot, '.env.development'),
      'VITE_TEST_VALUE=mode',
    )
    fs.writeFileSync(
      path.join(projectRoot, '.env.development.local'),
      'VITE_TEST_VALUE=mode-local',
    )

    delete process.env.VITE_TEST_VALUE
    loadElectronEnv({ mode: 'development', projectRoot })

    assert.equal(process.env.VITE_TEST_VALUE, 'mode-local')
  } finally {
    delete process.env.VITE_TEST_VALUE
    fs.rmSync(projectRoot, { force: true, recursive: true })
  }
})

test('dotenv 不覆盖已有系统环境变量', () => {
  const { loadElectronEnv } = require('../../electron/env.cjs')
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-env-'))

  try {
    fs.writeFileSync(path.join(projectRoot, '.env'), 'VITE_TEST_VALUE=file')
    process.env.VITE_TEST_VALUE = 'system'

    loadElectronEnv({ mode: 'development', projectRoot })

    assert.equal(process.env.VITE_TEST_VALUE, 'system')
  } finally {
    delete process.env.VITE_TEST_VALUE
    fs.rmSync(projectRoot, { force: true, recursive: true })
  }
})

test('按 NODE_ENV 内置互斥的 PROD 和 DEV 标记', () => {
  const { loadElectronEnv } = require('../../electron/env.cjs')
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-env-'))
  const originalNodeEnv = process.env.NODE_ENV
  const originalProd = process.env.PROD
  const originalDev = process.env.DEV

  try {
    process.env.NODE_ENV = 'production'
    loadElectronEnv({ mode: 'development', projectRoot })

    assert.equal(process.env.PROD, 'true')
    assert.equal(process.env.DEV, 'false')

    process.env.NODE_ENV = 'development'
    loadElectronEnv({ mode: 'production', projectRoot })

    assert.equal(process.env.PROD, 'false')
    assert.equal(process.env.DEV, 'true')
  } finally {
    if (originalNodeEnv === undefined) {delete process.env.NODE_ENV}
    else {process.env.NODE_ENV = originalNodeEnv}
    if (originalProd === undefined) {delete process.env.PROD}
    else {process.env.PROD = originalProd}
    if (originalDev === undefined) {delete process.env.DEV}
    else {process.env.DEV = originalDev}
    fs.rmSync(projectRoot, { force: true, recursive: true })
  }
})

test('解析 VITE_ 布尔配置', () => {
  const { isEnabled } = require('../../electron/env.cjs')

  assert.equal(isEnabled('true'), true)
  assert.equal(isEnabled('1'), true)
  assert.equal(isEnabled('false'), false)
  assert.equal(isEnabled(undefined), false)
})
