import { SWAGGER_DICTIONARY } from "@shared/static/SWAGGER_DICTIONARY"

import { HTTP_STATUS_ERROR_CODES } from "../../AppExceptionFilter"

const createSwaggerErrorExample = (
  status: number,
  summary: string,
  message: string,
) => ({
  summary,
  value: {
    error: {
      code: HTTP_STATUS_ERROR_CODES[status] ?? `HTTP_${status}`,
      message,
      details: null,
      requestId: SWAGGER_DICTIONARY.errorEnvelope.requestIdExample,
    },
  },
})

export { createSwaggerErrorExample }
