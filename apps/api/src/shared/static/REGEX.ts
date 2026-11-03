const REGEX = {
  POSITIVE_INTEGER: /^[1-9]\d*$/,
  CAMEL_CASE: /^[a-z][a-zA-Z0-9]*$/,
  USERNAME: /^[a-z0-9_]+$/,
  REGEX_SPECIAL_CHARACTERS: /[.*+?^${}()|[\]\\]/g,
  TRAILING_SLASH: /\/$/,
  TRAILING_SLASHES: /\/+$/,
  MONGO_OBJECT_ID: /^[a-fA-F0-9]{24}$/,
  BEARER_AUTHORIZATION: /^Bearer [^\s]+$/i,
  LOG_KEY_SEPARATORS: /[_-]/g,
  SENSITIVE_LOG_KEY: /password|token|authorization|cookie|secret|apikey/,
  DIGITS: /^\d+$/,
  APP_NAME: /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
  SEMANTIC_VERSION:
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
  ISO_TIMEZONE_SUFFIX: /(?:Z|[+-]\d{2}:\d{2})$/,
  MAIL_DOMAIN:
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/,
  HTTP_ERROR_CODE: /^HTTP_\d+$/,
  BACKGROUND_COOKIE: /(?:^|;\s*)biskyBackground=(\d+)(?:;|$)/,
  ACCESS_CODE: /^[A-Za-z0-9_-]{32}$/,
  CONFIRMATION_CODE: /^[0-9]{6}$/,
  BASIC_AUTHORIZATION: /^Basic ([A-Za-z0-9+/]+={0,2})$/i,
  MERMAID_CHUNK_PATH: /^\/chunks\/mermaid\.esm\.min\/[\w.-]+\.mjs$/,
}

export { REGEX }
