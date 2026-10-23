import { isNil } from "@shared/functions/checks/isNil"

import { REQUEST_CONTEXT_STORAGE } from "../static/REQUEST_CONTEXT_STORAGE"
import type { IRequestContext } from "../types/IRequestContext"

const requestContext = {
  run: <T>(context: IRequestContext, callback: () => T) => {
    return REQUEST_CONTEXT_STORAGE.run(context, callback)
  },
  get: (key: string) => {
    return REQUEST_CONTEXT_STORAGE.getStore()?.[key]
  },
  getAll: () => {
    const context = REQUEST_CONTEXT_STORAGE.getStore()

    return isNil(context) ? undefined : { ...context }
  },
  set: (key: string, value: unknown) => {
    const context = REQUEST_CONTEXT_STORAGE.getStore()

    if (!isNil(context)) {
      context[key] = value
    }
  },
}

export { requestContext }
