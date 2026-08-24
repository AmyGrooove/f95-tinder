import { isFunction } from "@shared/functions/isFunction"
import { isObject } from "@shared/functions/isObject"

import type { IIterableCacheStore } from "../types/IIterableCacheStore"

const isIterableCacheStore = (store: unknown): store is IIterableCacheStore => {
  return (
    isObject(store) &&
    "iterator" in store &&
    isFunction(store.iterator) &&
    "delete" in store &&
    isFunction(store.delete)
  )
}

export { isIterableCacheStore }
