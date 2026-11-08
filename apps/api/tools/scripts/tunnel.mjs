import { spawn } from "node:child_process"

const readRequiredEnv = (name) => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Не задана переменная ${name} в .env.tunnel.`)
  }

  return value
}

const readPort = (name, fallback) => {
  const value = process.env[name]?.trim() || fallback
  const port = Number(value)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} должен быть целым числом от 1 до 65535.`)
  }

  return port
}

const validateContainerName = (name, value) => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(value)) {
    throw new Error(`${name} содержит недопустимое имя Docker-контейнера.`)
  }
}

const inspectContainers = (sshTarget, containerNames) =>
  new Promise((resolve, reject) => {
    const ssh = spawn(
      "ssh",
      [
        sshTarget,
        "docker",
        "inspect",
        "--type",
        "container",
        ...containerNames,
      ],
      {
        stdio: ["inherit", "pipe", "inherit"],
        windowsHide: true,
      },
    )
    let output = ""
    let settled = false

    ssh.stdout.setEncoding("utf8")
    ssh.stdout.on("data", (chunk) => {
      output += chunk
    })

    ssh.once("error", (error) => {
      settled = true
      reject(new Error(`Не удалось запустить ssh: ${error.message}`))
    })

    ssh.once("close", (code) => {
      if (settled) {
        return
      }

      if (code !== 0) {
        reject(
          new Error(
            `Не удалось найти контейнеры ${containerNames.join(", ")} или выполнить docker inspect на сервере.`,
          ),
        )
        return
      }

      try {
        resolve(JSON.parse(output))
      } catch {
        reject(new Error("docker inspect вернул некорректный JSON."))
      }
    })
  })

const getContainerIp = (container, containerName) => {
  const networks = container?.NetworkSettings?.Networks
  const ip = networks
    ? Object.values(networks).find((network) => network?.IPAddress?.trim())
        ?.IPAddress
    : undefined

  if (!ip) {
    throw new Error(`Не удалось определить IP контейнера ${containerName}.`)
  }

  return ip
}

const formatForwardHost = (ip) => (ip.includes(":") ? `[${ip}]` : ip)

const main = async () => {
  const sshHost = readRequiredEnv("SSH_HOST")
  const sshUser = readRequiredEnv("SSH_USER")
  const mongoContainer = readRequiredEnv("MONGO_CONTAINER")
  const redisContainer = readRequiredEnv("REDIS_CONTAINER")
  const mongoLocalPort = readPort("MONGO_LOCAL_PORT", "27018")
  const redisLocalPort = readPort("REDIS_LOCAL_PORT", "6380")

  validateContainerName("MONGO_CONTAINER", mongoContainer)
  validateContainerName("REDIS_CONTAINER", redisContainer)

  if (mongoLocalPort === redisLocalPort) {
    throw new Error("MONGO_LOCAL_PORT и REDIS_LOCAL_PORT должны отличаться.")
  }

  const sshTarget = `${sshUser}@${sshHost}`

  console.log(`Подключаюсь к ${sshTarget} и определяю IP контейнеров...`)

  const containers = await inspectContainers(sshTarget, [
    mongoContainer,
    redisContainer,
  ])

  if (!Array.isArray(containers) || containers.length !== 2) {
    throw new Error("docker inspect не вернул данные для обоих контейнеров.")
  }

  const mongoIp = getContainerIp(containers[0], mongoContainer)
  const redisIp = getContainerIp(containers[1], redisContainer)
  const mongoForward = `127.0.0.1:${mongoLocalPort}:${formatForwardHost(mongoIp)}:27017`
  const redisForward = `127.0.0.1:${redisLocalPort}:${formatForwardHost(redisIp)}:6379`
  const tunnel = spawn(
    "ssh",
    [
      "-N",
      "-T",
      "-o",
      "ExitOnForwardFailure=yes",
      "-L",
      mongoForward,
      "-L",
      redisForward,
      sshTarget,
    ],
    {
      stdio: "inherit",
      windowsHide: true,
    },
  )
  let stopping = false
  let spawnFailed = false

  const stopTunnel = () => {
    if (stopping) {
      return
    }

    stopping = true
    console.log("\nЗавершаю SSH-туннели...")

    if (tunnel.exitCode === null) {
      tunnel.kill("SIGTERM")

      const forceStopTimer = setTimeout(() => {
        if (tunnel.exitCode === null) {
          tunnel.kill("SIGKILL")
        }
      }, 3000)

      forceStopTimer.unref()
    }
  }

  process.once("SIGINT", stopTunnel)
  process.once("SIGTERM", stopTunnel)

  tunnel.once("spawn", () => {
    console.log("SSH-туннели запущены:")
    console.log(`  MongoDB 127.0.0.1:${mongoLocalPort} -> ${mongoIp}:27017`)
    console.log(`  Redis   127.0.0.1:${redisLocalPort} -> ${redisIp}:6379`)
    console.log("Нажмите Ctrl+C для завершения.")
  })

  tunnel.once("error", (error) => {
    spawnFailed = true
    console.error(`Не удалось запустить ssh: ${error.message}`)
    process.exitCode = 1
  })

  tunnel.once("close", (code) => {
    process.removeListener("SIGINT", stopTunnel)
    process.removeListener("SIGTERM", stopTunnel)

    if (spawnFailed) {
      return
    }

    if (!stopping && code !== 0) {
      console.error(`SSH-туннель завершился с кодом ${code}.`)
      process.exitCode = typeof code === "number" && code > 0 ? code : 1
    }
  })
}

main().catch((error) => {
  console.error(`Ошибка: ${error.message}`)
  process.exitCode = 1
})
