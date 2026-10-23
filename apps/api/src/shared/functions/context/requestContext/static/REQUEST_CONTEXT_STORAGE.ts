import { AsyncLocalStorage } from "node:async_hooks"

import type { IRequestContext } from "../types/IRequestContext"

const REQUEST_CONTEXT_STORAGE = new AsyncLocalStorage<IRequestContext>()

export { REQUEST_CONTEXT_STORAGE }
