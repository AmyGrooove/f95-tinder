import { AsyncLocalStorage } from "node:async_hooks"

import { isNil } from "@shared/functions/checks/isNil"

import type { IRequestContext } from "../types/IRequestContext"

const storage = new AsyncLocalStorage<IRequestContext>()

const requestContext = {
  run: <T>(context: IRequestContext, callback: () => T) => {
    return storage.run(context, callback)
  },
  get: (key: string) => {
    return storage.getStore()?.[key]
  },
  getAll: () => {
    const context = storage.getStore()

    return isNil(context) ? undefined : { ...context }
  },
  set: (key: string, value: unknown) => {
    const context = storage.getStore()

    if (!isNil(context)) {
      context[key] = value
    }
  },
}

export { requestContext }
