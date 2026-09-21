import { createAppConfiguration } from "../functions/createAppConfiguration"
import { createRedisConfiguration } from "../functions/createRedisConfiguration"
import { getEnvironmentUrl } from "../functions/getEnvironmentUrl"
import { getRequiredEnvironmentValue } from "../functions/getRequiredEnvironmentValue"
import { CONFIG_ERROR_MESSAGES } from "../static/CONFIG_ERROR_MESSAGES"
import { isInt } from "@shared/functions/checks/isInt"

const createInfrastructureConfiguration = () => {
  const mongoUrl = getEnvironmentUrl("MONGO_URL", ["mongodb:", "mongodb+srv:"])
  const accessSecret = getRequiredEnvironmentValue("JWT_ACCESS_SECRET")
  const refreshSecret = getRequiredEnvironmentValue("JWT_REFRESH_SECRET")
  const mailDomain = getRequiredEnvironmentValue("MAIL_DOMAIN")
  const smtpPort = Number(getRequiredEnvironmentValue("SMTP_PORT"))
  const smtpSecure = getRequiredEnvironmentValue("SMTP_SECURE")

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

  if (!isInt(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_SMTP_PORT)
  }

  if (smtpSecure !== "true" && smtpSecure !== "false") {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_SMTP_SECURE)
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
      endpoint: getEnvironmentUrl("MINIO_URL", ["http:", "https:"]).toString(),
      accessKey: getRequiredEnvironmentValue("MINIO_ACCESS_KEY"),
      secretKey: getRequiredEnvironmentValue("MINIO_ACCESS_SECRET"),
      publicUrl: getEnvironmentUrl("MINIO_PUBLIC_URL", [
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
      domain: mailDomain,
      host: getRequiredEnvironmentValue("SMTP_HOST"),
      password: getRequiredEnvironmentValue("SMTP_PASSWORD"),
      port: smtpPort,
      secure: smtpSecure === "true",
      user: getRequiredEnvironmentValue("SMTP_USER"),
    },
    openObserve: {
      url: getEnvironmentUrl("OPENOBSERVE_URL", ["http:", "https:"]).toString(),
      username: getRequiredEnvironmentValue("OPENOBSERVE_USERNAME"),
      password: getRequiredEnvironmentValue("OPENOBSERVE_PASSWORD"),
    },
  }
}

export { createInfrastructureConfiguration }
