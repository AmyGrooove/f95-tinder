import { CONFIG_ERROR_MESSAGES } from "../../../static/CONFIG_ERROR_MESSAGES"
import { getEnvironmentUrl } from "../../getEnvironmentUrl"

const createRedisConfiguration = () => {
  const url = getEnvironmentUrl("REDIS_URL", ["redis:", "rediss:"])
  const databaseValue = url.pathname.slice(1)

  if (databaseValue !== "" && !/^\d+$/.test(databaseValue)) {
    throw new Error(CONFIG_ERROR_MESSAGES.REDIS_DATABASE)
  }

  const database = databaseValue === "" ? 0 : Number(databaseValue)

  if (!Number.isSafeInteger(database)) {
    throw new Error(CONFIG_ERROR_MESSAGES.REDIS_DATABASE)
  }

  return {
    url: url.toString(),
    host: url.hostname,
    port: url.port !== "" ? Number(url.port) : undefined,
    database,
    isTls: url.protocol === "rediss:",
    password:
      url.password !== "" ? decodeURIComponent(url.password) : undefined,
    username:
      url.username !== "" ? decodeURIComponent(url.username) : undefined,
  }
}

export { createRedisConfiguration }
