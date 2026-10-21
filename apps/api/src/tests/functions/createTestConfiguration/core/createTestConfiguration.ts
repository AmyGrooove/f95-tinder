import { randomUUID } from "node:crypto"

import type { TInfrastructureConfiguration } from "@infrastructure/config/types/TInfrastructureConfiguration"

const createTestConfiguration = (mongoUri: string, redisUrl: string) => {
  const redis = new URL(redisUrl)

  return {
    app: {
      environment: "development",
      name: "bisky-test",
      version: "1.0.0",
      description: "API integration tests",
      port: 3000,
      corsOrigins: ["http://localhost"],
    },
    database: { uri: mongoUri },
    redis: {
      url: redisUrl,
      host: redis.hostname,
      port: Number(redis.port),
      database: 0,
      isTls: false,
      password: undefined,
      username: undefined,
    },
    jwt: {
      accessSecret: randomUUID(),
      refreshSecret: randomUUID(),
    },
    storage: {
      endpoint: "http://127.0.0.1:1",
      region: "test",
      accessKey: "test",
      secretKey: "test",
      publicUrl: "http://127.0.0.1:1",
    },
    search: { host: "http://127.0.0.1:1", apiKey: "test" },
    mail: { apiKey: "test", domain: "example.test" },
    sources: { kodikApiToken: "test" },
  } satisfies TInfrastructureConfiguration
}

export { createTestConfiguration }
