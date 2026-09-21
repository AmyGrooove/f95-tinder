const CONFIG_ERROR_MESSAGES = {
  MISSING_REQUIRED_ENVIRONMENT_VALUE: "Missing required environment value",
  INVALID_ENVIRONMENT_URL: "Invalid environment URL",
  INVALID_URL_PROTOCOL: "Environment URL has invalid protocol",
  INVALID_NODE_ENV: "NODE_ENV must be either development or production",
  INVALID_PORT: "PORT must be an integer between 1 and 65535",
  INVALID_APP_NAME:
    "APP_NAME must be a lowercase MinIO bucket name between 3 and 63 characters",
  INVALID_APP_VERSION: "APP_VERSION must be a valid semantic version",
  EMPTY_APP_DESCRIPTION: "APP_DESCRIPTION must not be empty",
  INVALID_CORS_ORIGINS:
    "CORS_ORIGINS must contain valid HTTP(S) origins or '*'",
  EMPTY_CORS_ORIGINS: "CORS_ORIGINS must contain at least one origin",
  PRODUCTION_CORS_ORIGINS:
    "CORS_ORIGINS must contain explicit origins in production",
  REDIS_DATABASE: "REDIS_URL database must be a non-negative integer",
  JWT_SECRET_LENGTH: "JWT secrets must be at least 32 characters long",
  INVALID_MAIL_DOMAIN: "MAIL_DOMAIN must be a valid email domain",
  INVALID_SMTP_PORT: "SMTP_PORT must be an integer from 1 to 65535",
  INVALID_SMTP_SECURE: "SMTP_SECURE must be true or false",
} as const

export { CONFIG_ERROR_MESSAGES }
