import { REGEX } from "@shared/static/REGEX"
import { getRequiredEnvironmentValue } from "../../getRequiredEnvironmentValue"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"

import { CONFIG_ERROR_MESSAGES } from "../../../static/CONFIG_ERROR_MESSAGES"
import type { TEnvironmentNode } from "../types/TEnvironmentNode"

const createAppConfiguration = () => {
  const environmentValue = process.env.NODE_ENV
  const environment = isNil(environmentValue)
    ? "development"
    : environmentValue.trim()
  const name = getRequiredEnvironmentValue("APP_NAME")
  const siteVariant = process.env.SITE_VARIANT?.trim() ?? "main"
  const version = getRequiredEnvironmentValue("APP_VERSION")
  const description = getRequiredEnvironmentValue("APP_DESCRIPTION")
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

      let url: URL

      try {
        url = new URL(corsOrigin)
      } catch {
        throw new Error(CONFIG_ERROR_MESSAGES.INVALID_CORS_ORIGINS)
      }

      if (
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

  if (siteVariant !== "main" && siteVariant !== "adult") {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_SITE_VARIANT)
  }

  if (!isInt(port) || port < 1 || port > 65_535) {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_PORT)
  }

  if (!REGEX.APP_NAME.test(name)) {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_APP_NAME)
  }

  if (!REGEX.SEMANTIC_VERSION.test(version)) {
    throw new Error(CONFIG_ERROR_MESSAGES.INVALID_APP_VERSION)
  }

  if (description.trim() === "") {
    throw new Error(CONFIG_ERROR_MESSAGES.EMPTY_APP_DESCRIPTION)
  }

  if (corsOrigins.length === 0) {
    throw new Error(CONFIG_ERROR_MESSAGES.EMPTY_CORS_ORIGINS)
  }

  if (environment === "production" && corsOrigins.includes("*")) {
    throw new Error(CONFIG_ERROR_MESSAGES.PRODUCTION_CORS_ORIGINS)
  }

  return {
    environment: environment satisfies TEnvironmentNode,
    name,
    siteVariant,
    version,
    description,
    port,
    corsOrigins,
  }
}

export { createAppConfiguration }
