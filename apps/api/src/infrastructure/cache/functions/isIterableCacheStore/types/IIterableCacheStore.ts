interface IIterableCacheStore {
  delete: (key: string) => Promise<boolean>
  iterator: (
    options?: Record<string, unknown>,
  ) => AsyncIterable<[unknown, unknown]>
}

export type { IIterableCacheStore }
