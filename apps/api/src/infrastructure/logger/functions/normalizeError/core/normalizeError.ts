import { isArray } from "@shared/functions/isArray";
import { isObject } from "@shared/functions/isObject";
import { isString } from "@shared/functions/isString";

import { redactLogValue } from "../../redactLogValue";
import type { TNormalizedError } from "../../../types/TNormalizedError";

const normalizeError = (error: unknown): TNormalizedError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (isString(error)) {
    return {
      message: error,
    };
  }

  if (isArray(error)) {
    const redactedError = redactLogValue(error);

    return {
      message: "Unknown error",
      details: isArray(redactedError) ? redactedError : null,
    };
  }

  if (isObject(error)) {
    const redactedError = redactLogValue(error);

    return {
      message: "Unknown error",
      details: isObject(redactedError)
        ? Object.fromEntries(Object.entries(redactedError))
        : null,
    };
  }

  return {
    message: "Unknown error",
  };
};

export { normalizeError };
