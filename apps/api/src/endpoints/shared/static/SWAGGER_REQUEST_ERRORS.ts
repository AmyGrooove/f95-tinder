import { SWAGGER_DICTIONARY } from "./SWAGGER_DICTIONARY"

const { common } = SWAGGER_DICTIONARY

const SWAGGER_REQUEST_ERRORS = {
  bodyTooLarge: { status: 413, description: common.requestBodyTooLarge },
  unsupportedMediaType: {
    status: 415,
    description: common.unsupportedRequestMediaType,
  },
}

export { SWAGGER_REQUEST_ERRORS }
