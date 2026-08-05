const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')

function getElectronMode(argv = process.argv) {
  const inlineMode = argv.find((arg) => arg.startsWith('--mode='))
  if (inlineMode) {
    return inlineMode.slice('--mode='.length)
  }

  const modeIndex = argv.indexOf('--mode')
  if (modeIndex !== -1 && argv[modeIndex + 1]) {
    return argv[modeIndex + 1]
  }

  return 'development'
}

function getEnvFiles(projectRoot, mode) {
  return [`.env.${mode}.local`, `.env.${mode}`, '.env.local', '.env'].map(
    (file) => path.join(projectRoot, file),
  )
}

function loadElectronEnv({ projectRoot, mode }) {
  const envFiles = getEnvFiles(projectRoot, mode).filter(fs.existsSync)

  dotenv.config({
    path: envFiles,
    quiet: true,
  })

  const isProduction = process.env.NODE_ENV === 'production'
  process.env.PROD = String(isProduction)
  process.env.DEV = String(!isProduction)

  return envFiles
}

function isEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

module.exports = {
  getElectronMode,
  getEnvFiles,
  isEnabled,
  loadElectronEnv,
}
