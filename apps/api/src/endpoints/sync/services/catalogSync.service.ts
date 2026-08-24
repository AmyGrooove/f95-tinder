import { ConflictException, Injectable } from "@nestjs/common"

import { CacheService } from "@infrastructure/cache/services/cache.service"

import { CATALOG_SYNC_CONTROL_KEY } from "../static/CATALOG_SYNC_CONTROL_KEY"
import { CATALOG_SYNC_LOCK_KEY } from "../static/CATALOG_SYNC_LOCK_KEY"
import { CATALOG_SYNC_LOCK_TTL_MS } from "../static/CATALOG_SYNC_LOCK_TTL_MS"
import type { TCatalogSyncMode } from "../types/TCatalogSyncMode"
import type { TCatalogSyncStatus } from "../types/TCatalogSyncStatus"
import { CatalogSyncControlService } from "./catalogSyncControl.service"
import { CatalogSyncRunnerService } from "./catalogSyncRunner.service"
import { CatalogSyncStatusService } from "./catalogSyncStatus.service"

@Injectable()
class CatalogSyncService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly catalogSyncControlService: CatalogSyncControlService,
    private readonly catalogSyncRunnerService: CatalogSyncRunnerService,
    private readonly catalogSyncStatusService: CatalogSyncStatusService,
  ) {}

  syncFullCatalog(): Promise<TCatalogSyncStatus> {
    return this.runLockedSync("fullCatalog")
  }

  startFullCatalog(): Promise<TCatalogSyncStatus> {
    return this.startLockedSync("fullCatalog")
  }

  syncLatestCatalogUpdates(): Promise<TCatalogSyncStatus> {
    return this.runLockedSync("latestUpdates")
  }

  startLatestCatalogUpdates(): Promise<TCatalogSyncStatus> {
    return this.startLockedSync("latestUpdates")
  }

  pauseCatalogSync(): Promise<TCatalogSyncStatus> {
    return this.catalogSyncControlService.pauseCatalogSync()
  }

  resumeCatalogSync(): Promise<TCatalogSyncStatus> {
    return this.catalogSyncControlService.resumeCatalogSync()
  }

  stopCatalogSync(): Promise<TCatalogSyncStatus> {
    return this.catalogSyncControlService.stopCatalogSync()
  }

  private async runLockedSync(
    mode: TCatalogSyncMode,
  ): Promise<TCatalogSyncStatus> {
    await this.assertCatalogSyncCanStart()

    await this.cacheService.set(
      CATALOG_SYNC_LOCK_KEY,
      "running",
      CATALOG_SYNC_LOCK_TTL_MS,
    )
    await this.cacheService.delete(CATALOG_SYNC_CONTROL_KEY)

    try {
      return await this.catalogSyncRunnerService.runSync(mode)
    } finally {
      await this.cacheService.delete(CATALOG_SYNC_LOCK_KEY)
      await this.cacheService.delete(CATALOG_SYNC_CONTROL_KEY)
    }
  }

  private async startLockedSync(
    mode: TCatalogSyncMode,
  ): Promise<TCatalogSyncStatus> {
    await this.assertCatalogSyncCanStart()

    await this.cacheService.set(
      CATALOG_SYNC_LOCK_KEY,
      "running",
      CATALOG_SYNC_LOCK_TTL_MS,
    )
    await this.cacheService.delete(CATALOG_SYNC_CONTROL_KEY)

    const status = this.catalogSyncStatusService.createInitialStatus(mode)

    await this.catalogSyncStatusService.setStatus(status)

    void this.catalogSyncRunnerService
      .runSync(mode)
      .finally(async () => {
        await this.cacheService.delete(CATALOG_SYNC_LOCK_KEY)
        await this.cacheService.delete(CATALOG_SYNC_CONTROL_KEY)
      })
      .catch(() => {
        return
      })

    return status
  }

  private async assertCatalogSyncCanStart() {
    const syncLock = await this.cacheService.get<string>(CATALOG_SYNC_LOCK_KEY)

    if (!syncLock) {
      return
    }

    const status = await this.catalogSyncStatusService.getStatus()

    if (
      status.status === "idle" ||
      status.status === "completed" ||
      status.status === "failed" ||
      status.status === "stopped"
    ) {
      await this.cacheService.delete(CATALOG_SYNC_LOCK_KEY)
      await this.cacheService.delete(CATALOG_SYNC_CONTROL_KEY)

      return
    }

    throw new ConflictException("Catalog sync is already running")
  }
}

export { CatalogSyncService }
