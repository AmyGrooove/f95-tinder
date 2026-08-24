import { isString } from "@shared/functions/isString"

const validateEnvironment = (configuration: Record<string, unknown>) => {
  const environment = isString(configuration.NODE_ENV)
    ? configuration.NODE_ENV.trim()
    : "development"
  const portValue = isString(configuration.PORT)
    ? configuration.PORT.trim()
    : ""
  const appName = isString(configuration.APP_NAME)
    ? configuration.APP_NAME.trim()
    : ""
  const mongoUrl = isString(configuration.MONGO_URL)
    ? configuration.MONGO_URL.trim()
    : ""
  const redisUrl = isString(configuration.REDIS_URL)
    ? configuration.REDIS_URL.trim()
    : ""
  const accessSecret = isString(configuration.JWT_ACCESS_SECRET)
    ? configuration.JWT_ACCESS_SECRET.trim()
    : ""
  const refreshSecret = isString(configuration.JWT_REFRESH_SECRET)
    ? configuration.JWT_REFRESH_SECRET.trim()
    : ""
  const corsOriginsValue = isString(configuration.CORS_ORIGINS)
    ? configuration.CORS_ORIGINS.trim()
    : ""
  const missingKeys = [
    ["APP_NAME", appName],
    ["PORT", portValue],
    ["MONGO_URL", mongoUrl],
    ["REDIS_URL", redisUrl],
    ["JWT_ACCESS_SECRET", accessSecret],
    ["JWT_REFRESH_SECRET", refreshSecret],
  ].filter(([, value]) => {
    return value.length === 0
  })

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment values: ${missingKeys
        .map(([key]) => {
          return key
        })
        .join(", ")}`,
    )
  }

  const port = Number(portValue)

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer")
  }

  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(appName)) {
    throw new Error(
      "APP_NAME must be a lowercase MinIO bucket name between 3 and 63 characters",
    )
  }

  const corsOrigins = corsOriginsValue
    .split(",")
    .map((corsOrigin) => {
      return corsOrigin.trim()
    })
    .filter((corsOrigin) => {
      return corsOrigin.length > 0
    })

  corsOrigins.forEach((corsOrigin) => {
    if (corsOrigin === "*") {
      return
    }

    try {
      const corsOriginUrl = new URL(corsOrigin)

      if (
        corsOriginUrl.protocol !== "http:" &&
        corsOriginUrl.protocol !== "https:"
      ) {
        throw new Error("Invalid CORS origin protocol")
      }
    } catch {
      throw new Error("CORS_ORIGINS must contain valid HTTP(S) URLs or '*'")
    }
  })

  if (
    environment === "production" &&
    (corsOrigins.length === 0 || corsOrigins.includes("*"))
  ) {
    throw new Error("CORS_ORIGINS must contain explicit origins in production")
  }

  try {
    const mongoConnectionUrl = new URL(mongoUrl)

    if (
      mongoConnectionUrl.protocol !== "mongodb:" &&
      mongoConnectionUrl.protocol !== "mongodb+srv:"
    ) {
      throw new Error("Invalid MongoDB protocol")
    }
  } catch {
    throw new Error("Invalid environment URL: MONGO_URL")
  }

  try {
    const redisConnectionUrl = new URL(redisUrl)

    if (
      redisConnectionUrl.protocol !== "redis:" &&
      redisConnectionUrl.protocol !== "rediss:"
    ) {
      throw new Error("Invalid Redis protocol")
    }
  } catch {
    throw new Error("Invalid environment URL: REDIS_URL")
  }

  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error("JWT secrets must be at least 32 characters long")
  }

  return Object.assign({}, configuration, {
    NODE_ENV: environment,
    APP_NAME: appName,
    PORT: portValue,
    MONGO_URL: mongoUrl,
    REDIS_URL: redisUrl,
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    CORS_ORIGINS: corsOriginsValue,
  })
}

export { validateEnvironment }
