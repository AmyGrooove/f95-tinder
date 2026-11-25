import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { SWAGGER_REQUEST_ERRORS } from "@endpoints/shared/static/SWAGGER_REQUEST_ERRORS"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { createSwaggerErrorExample } from "@infrastructure/logger/decorators/ApiEndpoint"

const { common, userItem } = SWAGGER_DICTIONARY

const commonErrors = [
  { status: 400, description: common.invalidRequest },
  { status: 401, description: common.unauthorized },
  { status: 403, description: common.csrfFailed },
  { status: 429, description: common.rateLimitExceeded },
]

const entryNotFound = { status: 404, description: userItem.entryNotFound }
const bodyErrors = [
  SWAGGER_REQUEST_ERRORS.bodyTooLarge,
  SWAGGER_REQUEST_ERRORS.unsupportedMediaType,
]
const itemNotFound = {
  status: 404,
  description: SWAGGER_DICTIONARY.item.notFound,
}
const duplicateEntry = {
  status: 409,
  description: DICTIONARY.userItem.alreadyAdded,
  examples: {
    duplicateEntry: createSwaggerErrorExample(
      409,
      "Запись уже существует",
      DICTIONARY.userItem.alreadyAdded,
    ),
  },
}

const USER_ITEM_ERRORS = {
  create: [
    ...commonErrors,
    ...bodyErrors,
    itemNotFound,
    { ...duplicateEntry, description: userItem.createConflict },
  ],
  exclude: [...commonErrors, ...bodyErrors, itemNotFound, duplicateEntry],
  remove: [...commonErrors, entryNotFound],
  update: [
    ...commonErrors,
    ...bodyErrors,
    entryNotFound,
    { status: 409, description: userItem.updateConflict },
  ],
  createAttempt: [
    ...commonErrors,
    ...bodyErrors,
    entryNotFound,
    { status: 409, description: userItem.createAttemptConflict },
  ],
  updateAttempt: [
    ...commonErrors,
    ...bodyErrors,
    { status: 404, description: userItem.attemptOrEntryNotFound },
    { status: 409, description: userItem.updateAttemptConflict },
  ],
}

export { USER_ITEM_ERRORS }
