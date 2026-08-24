import { ERROR_CODES } from "../static/ERROR_CODES"

type TErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export type { TErrorCode }
