import { Injectable } from "@nestjs/common"

import { CacheService } from "@infrastructure/cache/services/cache.service"

import { CATALOG_SYNC_STATUS_KEY } from "../static/CATALOG_SYNC_STATUS_KEY"
import type { TCatalogSyncMode } from "../types/TCatalogSyncMode"
import type { TCatalogSyncStatus } from "../types/TCatalogSyncStatus"

@Injectable()
class CatalogSyncStatusService {
  constructor(private readonly cacheService: CacheService) {}

  async getStatus(): Promise<TCatalogSyncStatus> {
    const status = await this.cacheService.get<TCatalogSyncStatus>(
      CATALOG_SYNC_STATUS_KEY,
    )

    if (status) {
      return status
    }

    return {
      status: "idle",
      mode: null,
      currentPage: 0,
      gamesCreated: 0,
      gamesUpdated: 0,
      unknownTagIds: [],
      unknownPrefixIds: [],
      lastError: null,
      startedAt: null,
      updatedAt: null,
    }
  }

  async setStatus(status: TCatalogSyncStatus) {
    await this.cacheService.set(CATALOG_SYNC_STATUS_KEY, status)
  }

  createInitialStatus(mode: TCatalogSyncMode): TCatalogSyncStatus {
    const startedAt = new Date().toISOString()

    return {
      status: "running",
      mode,
      currentPage: 0,
      gamesCreated: 0,
      gamesUpdated: 0,
      unknownTagIds: [],
      unknownPrefixIds: [],
      lastError: null,
      startedAt,
      updatedAt: startedAt,
    }
  }

  async updateStatus(
    status: TCatalogSyncStatus,
    patch: Partial<TCatalogSyncStatus>,
  ): Promise<TCatalogSyncStatus> {
    const nextStatus: TCatalogSyncStatus = {
      status: patch.status ?? status.status,
      mode: patch.mode ?? status.mode,
      currentPage: patch.currentPage ?? status.currentPage,
      gamesCreated: patch.gamesCreated ?? status.gamesCreated,
      gamesUpdated: patch.gamesUpdated ?? status.gamesUpdated,
      unknownTagIds: patch.unknownTagIds ?? status.unknownTagIds,
      unknownPrefixIds: patch.unknownPrefixIds ?? status.unknownPrefixIds,
      lastError: patch.lastError ?? status.lastError,
      startedAt: patch.startedAt ?? status.startedAt,
      updatedAt: new Date().toISOString(),
    }

    await this.setStatus(nextStatus)

    return nextStatus
  }
}

export { CatalogSyncStatusService }
