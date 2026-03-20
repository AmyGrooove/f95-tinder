const { spawn } = require('node:child_process')

const electronBinaryPath = require('electron')
const childEnvironment = { ...process.env }
delete childEnvironment.ELECTRON_RUN_AS_NODE

const childProcess = spawn(
  electronBinaryPath,
  ['.', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    windowsHide: false,
    env: childEnvironment,
  },
)

childProcess.on('close', (code, signal) => {
  if (code === null) {
    console.error(`Electron exited with signal ${signal ?? 'unknown'}`)
    process.exit(1)
    return
  }

  process.exit(code)
})
