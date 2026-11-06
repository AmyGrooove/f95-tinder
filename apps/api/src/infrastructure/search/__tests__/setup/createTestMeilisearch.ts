import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { setTimeout } from "node:timers/promises"
import { promisify } from "node:util"
import { Meilisearch } from "meilisearch"

const docker = promisify(execFile)

const createTestMeilisearch = async () => {
  const apiKey = randomUUID()
  const { stdout } = await docker(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      `bisky-search-test-${randomUUID()}`,
      "--publish",
      "127.0.0.1::7700",
      "--env",
      `MEILI_MASTER_KEY=${apiKey}`,
      "--env",
      "MEILI_NO_ANALYTICS=true",
      "getmeili/meilisearch:v1.12.8",
    ],
    { timeout: 180_000 },
  )
  const containerId = stdout.trim()
  const close = async () => {
    await docker("docker", ["rm", "--force", containerId], { timeout: 30_000 })
  }

  try {
    const { stdout: port } = await docker("docker", [
      "port",
      containerId,
      "7700/tcp",
    ])
    const host = `http://${port.trim()}`
    const client = new Meilisearch({ host, apiKey, timeout: 1_000 })
    const deadline = Date.now() + 30_000

    while (true) {
      try {
        await client.health()
        return { client, configuration: { host, apiKey }, close }
      } catch (error) {
        if (Date.now() >= deadline) {
          throw error
        }
        await setTimeout(100)
      }
    }
  } catch (error) {
    try {
      await close()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Не удалось запустить и закрыть тестовый Meilisearch",
        { cause: cleanupError },
      )
    }
    throw error
  }
}

export { createTestMeilisearch }
