interface ICatalogSyncStatus {
  currentPage: number
  gamesCreated: number
  gamesUpdated: number
  lastError: string | null
  mode: 'fullCatalog' | 'latestUpdates' | null
  startedAt: string | null
  status:
    | 'idle'
    | 'running'
    | 'paused'
    | 'stopping'
    | 'rateLimited'
    | 'completed'
    | 'failed'
    | 'stopped'
  unknownPrefixIds: number[]
  unknownTagIds: number[]
  updatedAt: string | null
}

export type { ICatalogSyncStatus }
