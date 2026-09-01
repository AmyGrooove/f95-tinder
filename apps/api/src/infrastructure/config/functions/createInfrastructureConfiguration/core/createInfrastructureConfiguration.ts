const createInfrastructureConfiguration = () => {
  const redisUrl = new URL(String(process.env.REDIS_URL))
  const redisDatabase = Number(redisUrl.pathname.slice(1))

  return {
    app: {
      environment: process.env.NODE_ENV,
      name: String(process.env.APP_NAME),
      port: Number(process.env.PORT),
      version: process.env.npm_package_version,
      corsOrigins: process.env.CORS_ORIGINS?.split(",")
        .map((corsOrigin) => {
          return corsOrigin.trim()
        })
        .filter((corsOrigin) => {
          return corsOrigin.length > 0
        }),
    },
    database: {
      uri: String(process.env.MONGO_URL),
    },
    redis: {
      url: redisUrl.toString(),
      host: redisUrl.hostname,
      port: redisUrl.port !== "" ? Number(redisUrl.port) : undefined,
      database: redisDatabase,
      isTls: redisUrl.protocol === "rediss:",
      password:
        redisUrl.password !== ""
          ? decodeURIComponent(redisUrl.password)
          : undefined,
      username:
        redisUrl.username !== ""
          ? decodeURIComponent(redisUrl.username)
          : undefined,
    },
    jwt: {
      accessSecret: String(process.env.JWT_ACCESS_SECRET),
      refreshSecret: String(process.env.JWT_REFRESH_SECRET),
    },
    storage: {
      endpoint: process.env.MINIO_URL,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_ACCESS_SECRET,
      publicUrl: process.env.MINIO_PUBLIC_URL,
    },
    search: {
      host: process.env.MEILISEARCH_URL,
      apiKey: process.env.MEILISEARCH_ACCESS_SECRET,
    },
    mail: {
      apiKey: process.env.RESEND_ACCESS_SECRET,
      domain: process.env.MAIL_DOMAIN,
    },
    openObserve: {
      url:
        process.env.OPENOBSERVE_URL ??
        `http://localhost:5080/api/default/${String(process.env.APP_NAME)}/_json`,
      username: process.env.OPENOBSERVE_USERNAME,
      password: process.env.OPENOBSERVE_PASSWORD,
    },
  }
}

export { createInfrastructureConfiguration }
