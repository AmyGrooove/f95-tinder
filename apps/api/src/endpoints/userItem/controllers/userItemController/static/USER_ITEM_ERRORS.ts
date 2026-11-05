import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

const USER_ITEM_ERRORS = [
  { status: 400, description: SWAGGER_DICTIONARY.common.invalidRequest },
  { status: 401, description: SWAGGER_DICTIONARY.common.unauthorized },
  { status: 403, description: SWAGGER_DICTIONARY.common.csrfFailed },
  { status: 404, description: SWAGGER_DICTIONARY.userItem.notFound },
  { status: 409, description: SWAGGER_DICTIONARY.userItem.conflict },
  { status: 429, description: SWAGGER_DICTIONARY.common.rateLimitExceeded },
]

export { USER_ITEM_ERRORS }
