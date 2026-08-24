import type { TCatalogSyncDiagnostics } from "./TCatalogSyncDiagnostics"
import type { TCatalogSyncMode } from "./TCatalogSyncMode"

type TCatalogSyncStatus = TCatalogSyncDiagnostics & {
  status:
    | "idle"
    | "running"
    | "paused"
    | "stopping"
    | "rateLimited"
    | "completed"
    | "failed"
    | "stopped"
  mode: TCatalogSyncMode | null
  currentPage: number
  gamesCreated: number
  gamesUpdated: number
  lastError: string | null
  startedAt: string | null
  updatedAt: string | null
}

export type { TCatalogSyncStatus }
