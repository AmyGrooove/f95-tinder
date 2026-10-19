import { createAppConfiguration } from "../functions/createAppConfiguration"
import { createRedisConfiguration } from "../functions/createRedisConfiguration"
import { getEnvironmentUrl } from "../functions/getEnvironmentUrl"
import { getRequiredEnvironmentValue } from "../functions/getRequiredEnvironmentValue"
import { CONFIG_ERROR_MESSAGES } from "../static/CONFIG_ERROR_MESSAGES"

const createInfrastructureConfiguration = () => {
  const mongoUrl = getEnvironmentUrl("MONGO_URL", ["mongodb:", "mongodb+srv:"])
  const accessSecret = getRequiredEnvironmentValue("JWT_ACCESS_SECRET")
  const refreshSecret = getRequiredEnvironmentValue("JWT_REFRESH_SECRET")
  const mailDomain = getRequiredEnvironmentValue("MAIL_DOMAIN")

  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error(CONFIG_ERROR_MESSAGES.JWT_SECRET_LENGTH)
  }

  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(
      mailDomain,
    )
  ) {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_MAIL_DOMAIN)
  }

  return {
    app: createAppConfiguration(),
    database: {
      uri: mongoUrl.toString(),
    },
    redis: createRedisConfiguration(),
    jwt: {
      accessSecret,
      refreshSecret,
    },
    storage: {
      endpoint: getEnvironmentUrl("GARAGE_URL", ["http:", "https:"]).toString(),
      region: getRequiredEnvironmentValue("GARAGE_REGION"),
      accessKey: getRequiredEnvironmentValue("GARAGE_ACCESS_KEY_ID"),
      secretKey: getRequiredEnvironmentValue("GARAGE_SECRET_ACCESS_KEY"),
      publicUrl: getEnvironmentUrl("GARAGE_PUBLIC_URL", [
        "http:",
        "https:",
      ]).toString(),
    },
    search: {
      host: getEnvironmentUrl("MEILISEARCH_URL", [
        "http:",
        "https:",
      ]).toString(),
      apiKey: getRequiredEnvironmentValue("MEILISEARCH_ACCESS_SECRET"),
    },
    mail: {
      apiKey: getRequiredEnvironmentValue("RESEND_ACCESS_SECRET"),
      domain: mailDomain,
    },
    sources: {
      kodikApiToken: getRequiredEnvironmentValue("KODIK_API_TOKEN"),
    },
  }
}

export { createInfrastructureConfiguration }
