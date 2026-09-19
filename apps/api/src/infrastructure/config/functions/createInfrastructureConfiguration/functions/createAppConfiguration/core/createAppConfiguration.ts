import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"

import { CONFIG_ERROR_MESSAGES } from "../../../static/CONFIG_ERROR_MESSAGES"
import { getRequiredEnvironmentValue } from "../../getRequiredEnvironmentValue"
import { TEnvironmentNode } from "../types/TEnvironmentNode"

const createAppConfiguration = () => {
  const environmentValue = process.env.NODE_ENV as TEnvironmentNode | undefined
  const environment = isNil(environmentValue)
    ? "development"
    : (environmentValue.trim() as TEnvironmentNode)
  const name = getRequiredEnvironmentValue("APP_NAME")
  const port = Number(getRequiredEnvironmentValue("PORT"))
  const corsOrigins = getRequiredEnvironmentValue("CORS_ORIGINS")
    .split(",")
    .map((corsOrigin) => {
      return corsOrigin.trim()
    })
    .filter((corsOrigin) => {
      return corsOrigin.length > 0
    })
    .map((corsOrigin) => {
      if (corsOrigin === "*") {
        return corsOrigin
      }

      let url: URL | undefined

      try {
        url = new URL(corsOrigin)
      } catch {
        throw new Error(CONFIG_ERROR_MESSAGES.INVALID_CORS_ORIGINS)
      }

      if (
        isNil(url) ||
        (url.protocol !== "http:" && url.protocol !== "https:") ||
        url.pathname !== "/" ||
        url.search !== "" ||
        url.hash !== "" ||
        url.username !== "" ||
        url.password !== ""
      ) {
        throw new Error(CONFIG_ERROR_MESSAGES.INVALID_CORS_ORIGINS)
      }

      return url.origin
    })

  if (environment !== "development" && environment !== "production") {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_NODE_ENV)
  }

  if (!isInt(port) || port < 1 || port > 65_535) {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_PORT)
  }

  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name)) {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_APP_NAME)
  }

  if (corsOrigins.length === 0) {
    throw new Error(CONFIG_ERROR_MESSAGES.EMPTY_CORS_ORIGINS)
  }

  if (environment === "production" && corsOrigins.includes("*")) {
    throw new Error(CONFIG_ERROR_MESSAGES.PRODUCTION_CORS_ORIGINS)
  }

  return {
    environment,
    name,
    port,
    corsOrigins,
  }
}

export { createAppConfiguration }
