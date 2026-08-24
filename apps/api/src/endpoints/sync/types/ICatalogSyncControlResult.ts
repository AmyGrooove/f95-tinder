import type { TCatalogSyncStatus } from "./TCatalogSyncStatus"

interface ICatalogSyncControlResult {
  status: TCatalogSyncStatus
  isStopped: boolean
}

export type { ICatalogSyncControlResult }
