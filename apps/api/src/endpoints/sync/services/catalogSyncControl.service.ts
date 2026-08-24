import { Injectable } from "@nestjs/common"

import { CacheService } from "@infrastructure/cache/services/cache.service"

import { CATALOG_SYNC_CONTROL_KEY } from "../static/CATALOG_SYNC_CONTROL_KEY"
import { CATALOG_SYNC_PAUSE_WAIT_MS } from "../static/CATALOG_SYNC_PAUSE_WAIT_MS"
import type { ICatalogSyncControlResult } from "../types/ICatalogSyncControlResult"
import type { TCatalogSyncControl } from "../types/TCatalogSyncControl"
import type { TCatalogSyncStatus } from "../types/TCatalogSyncStatus"
import { CatalogSyncStatusService } from "./catalogSyncStatus.service"

@Injectable()
class CatalogSyncControlService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly catalogSyncStatusService: CatalogSyncStatusService,
  ) {}

  async pauseCatalogSync(): Promise<TCatalogSyncStatus> {
    const status = await this.catalogSyncStatusService.getStatus()

    if (status.status !== "running" && status.status !== "rateLimited") {
      return status
    }

    await this.cacheService.set<TCatalogSyncControl>(
      CATALOG_SYNC_CONTROL_KEY,
      "paused",
    )

    return this.catalogSyncStatusService.updateStatus(status, {
      status: "paused",
    })
  }

  async resumeCatalogSync(): Promise<TCatalogSyncStatus> {
    const status = await this.catalogSyncStatusService.getStatus()

    await this.cacheService.delete(CATALOG_SYNC_CONTROL_KEY)

    if (status.status !== "paused") {
      return status
    }

    return this.catalogSyncStatusService.updateStatus(status, {
      status: "running",
    })
  }

  async stopCatalogSync(): Promise<TCatalogSyncStatus> {
    const status = await this.catalogSyncStatusService.getStatus()

    if (
      status.status !== "running" &&
      status.status !== "paused" &&
      status.status !== "stopping" &&
      status.status !== "rateLimited"
    ) {
      return status
    }

    await this.cacheService.set<TCatalogSyncControl>(
      CATALOG_SYNC_CONTROL_KEY,
      "stopped",
    )

    return this.catalogSyncStatusService.updateStatus(status, {
      status: "stopping",
    })
  }

  async applyCatalogSyncControl(
    status: TCatalogSyncStatus,
  ): Promise<ICatalogSyncControlResult> {
    let nextStatus = status
    let control = await this.cacheService.get<TCatalogSyncControl>(
      CATALOG_SYNC_CONTROL_KEY,
    )

    while (control === "paused") {
      if (nextStatus.status !== "paused") {
        nextStatus = await this.catalogSyncStatusService.updateStatus(
          nextStatus,
          {
            status: "paused",
          },
        )
      }

      await new Promise((resolve) => {
        setTimeout(resolve, CATALOG_SYNC_PAUSE_WAIT_MS)
      })

      control = await this.cacheService.get<TCatalogSyncControl>(
        CATALOG_SYNC_CONTROL_KEY,
      )
    }

    if (control === "stopped") {
      nextStatus = await this.catalogSyncStatusService.updateStatus(
        nextStatus,
        {
          status: "stopped",
        },
      )

      return {
        status: nextStatus,
        isStopped: true,
      }
    }

    if (nextStatus.status === "paused") {
      nextStatus = await this.catalogSyncStatusService.updateStatus(
        nextStatus,
        {
          status: "running",
        },
      )
    }

    return {
      status: nextStatus,
      isStopped: false,
    }
  }
}

export { CatalogSyncControlService }
