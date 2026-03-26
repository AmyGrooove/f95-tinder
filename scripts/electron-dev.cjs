const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')

const electronBinaryPath = require('electron')

const DEV_SERVER_HOST = '127.0.0.1'
const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`

const createChildEnvironment = (patch = {}) => {
  const nextEnvironment = {
    ...process.env,
    ...patch,
  }
  delete nextEnvironment.ELECTRON_RUN_AS_NODE
  return nextEnvironment
}

const killChildProcess = (childProcess) => {
  if (!childProcess || childProcess.killed || childProcess.exitCode !== null) {
    return
  }

  childProcess.kill()
}

const waitForDevServer = async (viteProcess) => {
  const pingDevServer = () =>
    new Promise((resolve) => {
      const request = http.get(DEV_SERVER_URL, (response) => {
        response.resume()
        resolve(Boolean(response.statusCode && response.statusCode < 500))
      })

      request.on('error', () => {
        resolve(false)
      })

      request.setTimeout(500, () => {
        request.destroy()
        resolve(false)
      })
    })

  for (let attemptIndex = 0; attemptIndex < 120; attemptIndex += 1) {
    if (viteProcess.exitCode !== null) {
      throw new Error('Vite dev server завершился до запуска Electron.')
    }

    if (await pingDevServer()) {
      return
    }

    await delay(250)
  }

  throw new Error(`Не удалось дождаться Vite dev server на ${DEV_SERVER_URL}.`)
}

let isShuttingDown = false
let electronProcess = null

const shutdown = (exitCode = 0) => {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  killChildProcess(electronProcess)
  killChildProcess(viteProcess)

  setTimeout(() => {
    process.exit(exitCode)
  }, 100)
}

const vitePackageJsonPath = require.resolve('vite/package.json')
const viteCliPath = path.join(path.dirname(vitePackageJsonPath), 'bin', 'vite.js')
const viteProcess = spawn(
  process.execPath,
  [viteCliPath, '--host', DEV_SERVER_HOST, '--strictPort'],
  {
    stdio: 'inherit',
    windowsHide: false,
    env: createChildEnvironment(),
  },
)

viteProcess.on('close', (code) => {
  if (isShuttingDown) {
    return
  }

  shutdown(code ?? 1)
})

process.on('SIGINT', () => {
  shutdown(130)
})

process.on('SIGTERM', () => {
  shutdown(143)
})

void (async () => {
  try {
    await waitForDevServer(viteProcess)
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Не удалось поднять Vite dev server.',
    )
    shutdown(1)
    return
  }

  electronProcess = spawn(electronBinaryPath, ['.', ...process.argv.slice(2)], {
    stdio: 'inherit',
    windowsHide: false,
    env: createChildEnvironment({
      VITE_DEV_SERVER_URL: DEV_SERVER_URL,
    }),
  })

  electronProcess.on('close', (code, signal) => {
    if (isShuttingDown) {
      return
    }

    if (code === null) {
      console.error(`Electron exited with signal ${signal ?? 'unknown'}`)
      shutdown(1)
      return
    }

    shutdown(code)
  })
})()
