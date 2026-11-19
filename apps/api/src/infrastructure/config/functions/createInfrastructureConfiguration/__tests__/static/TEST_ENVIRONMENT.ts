const TEST_ENVIRONMENT = {
  APP_NAME: "test-api",
  APP_VERSION: "1.2.3",
  APP_DESCRIPTION: "Test API",
  PORT: "3000",
  CORS_ORIGINS: "https://app.example.test",
  MONGO_URL: "mongodb://db.example.test/catalog",
  REDIS_URL: "rediss://redis.example.test:6380/2",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "r".repeat(32),
  GARAGE_URL: "http://storage.example.test",
  GARAGE_REGION: "test-region",
  GARAGE_ACCESS_KEY_ID: "test-access-key",
  GARAGE_SECRET_ACCESS_KEY: "test-secret-key",
  GARAGE_PUBLIC_URL: "https://media.example.test/files",
  MEILISEARCH_URL: "https://search.example.test",
  MEILISEARCH_ACCESS_SECRET: "test-search-key",
  RESEND_ACCESS_SECRET: "test-mail-key",
  MAIL_DOMAIN: "mail.example.test",
  KODIK_API_TOKEN: "test-source-token",
}

export { TEST_ENVIRONMENT }
