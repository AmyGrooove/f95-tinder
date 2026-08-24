import { Injectable, InternalServerErrorException } from "@nestjs/common"
import type { Types } from "mongoose"

import { CreatorRepository } from "@entities/creator/services/creator.repository"
import { GameRepository } from "@entities/game/services/game.repository"
import { normalizeF95Game } from "@infrastructure/f95Client/functions/normalizeF95Game"
import { F95LatestClient } from "@infrastructure/f95Client/services/f95Latest.client"

import { CATALOG_SYNC_PAGE_WAIT_MS } from "../static/CATALOG_SYNC_PAGE_WAIT_MS"
import type { TCatalogSyncMode } from "../types/TCatalogSyncMode"
import type { TCatalogSyncStatus } from "../types/TCatalogSyncStatus"
import { CatalogSeedService } from "./catalogSeed.service"
import { CatalogSyncControlService } from "./catalogSyncControl.service"
import { CatalogSyncStatusService } from "./catalogSyncStatus.service"
import { isNil } from "@shared/functions/isNil"

@Injectable()
class CatalogSyncRunnerService {
  constructor(
    private readonly catalogSeedService: CatalogSeedService,
    private readonly catalogSyncControlService: CatalogSyncControlService,
    private readonly catalogSyncStatusService: CatalogSyncStatusService,
    private readonly creatorRepository: CreatorRepository,
    private readonly f95LatestClient: F95LatestClient,
    private readonly gameRepository: GameRepository,
  ) {}

  async runSync(mode: TCatalogSyncMode): Promise<TCatalogSyncStatus> {
    let status = this.catalogSyncStatusService.createInitialStatus(mode)

    await this.catalogSyncStatusService.setStatus(status)

    try {
      const objectIdMaps =
        await this.catalogSeedService.getCatalogObjectIdMaps()
      let page = 1
      let totalPages = 1
      let latestUpdatesStopPage: number | null = null

      while (page <= totalPages) {
        const pageControl =
          await this.catalogSyncControlService.applyCatalogSyncControl(status)

        status = pageControl.status

        if (pageControl.isStopped) {
          return status
        }

        const latestPage = await this.f95LatestClient.fetchLatestPage(page)

        if (latestPage.status === "rateLimited") {
          status = await this.catalogSyncStatusService.updateStatus(status, {
            status: "rateLimited",
            currentPage: page,
          })
          await new Promise((resolve) => {
            setTimeout(resolve, latestPage.retryAfterMs)
          })
          status = await this.catalogSyncStatusService.updateStatus(status, {
            status: "running",
          })
          continue
        }

        totalPages = Math.max(latestPage.totalPages, latestPage.page)

        for (const threadItem of latestPage.threadItems) {
          const threadControl =
            await this.catalogSyncControlService.applyCatalogSyncControl(status)

          status = threadControl.status

          if (threadControl.isStopped) {
            return status
          }

          const normalizedGame = normalizeF95Game({ threadItem })
          const existingGame = await this.gameRepository.findByF95ThreadId(
            normalizedGame.f95ThreadId,
          )

          const isLatestUpdatesKnownVersion =
            mode === "latestUpdates" &&
            !isNil(existingGame) &&
            existingGame.version === normalizedGame.version &&
            Boolean(existingGame.creatorId)

          if (isLatestUpdatesKnownVersion) {
            latestUpdatesStopPage ??= latestPage.page + 1
            continue
          }

          const creator = await this.creatorRepository.upsertBySlug({
            name: normalizedGame.creator,
            slug: this.createSlug(normalizedGame.creator),
          })

          if (!creator) {
            throw new InternalServerErrorException("Creator was not saved")
          }

          const tagIds = this.resolveObjectIds(
            normalizedGame.f95TagIds,
            objectIdMaps.tagObjectIdByF95Id,
          )
          const prefixIds = this.resolveObjectIds(
            normalizedGame.f95PrefixIds,
            objectIdMaps.prefixObjectIdByF95Id,
          )

          status = await this.recordUnknownIds(status, {
            f95TagIds: normalizedGame.f95TagIds,
            f95PrefixIds: normalizedGame.f95PrefixIds,
            knownTagIds: tagIds.knownF95Ids,
            knownPrefixIds: prefixIds.knownF95Ids,
          })

          const upsertResult = await this.gameRepository.upsertByF95ThreadId({
            f95ThreadId: normalizedGame.f95ThreadId,
            threadUrl: normalizedGame.threadUrl,
            title: normalizedGame.title,
            creatorId: creator._id,
            version: normalizedGame.version,
            coverUrl: normalizedGame.coverUrl,
            screenshotUrls: normalizedGame.screenshotUrls,
            f95UpdatedAt: normalizedGame.f95UpdatedAt,
            tagIds: tagIds.objectIds,
            prefixIds: prefixIds.objectIds,
          })

          status = await this.catalogSyncStatusService.updateStatus(status, {
            gamesCreated:
              status.gamesCreated + (upsertResult.isCreated ? 1 : 0),
            gamesUpdated:
              status.gamesUpdated + (upsertResult.isCreated ? 0 : 1),
          })
        }

        status = await this.catalogSyncStatusService.updateStatus(status, {
          currentPage: latestPage.page,
        })

        if (
          !isNil(latestUpdatesStopPage) &&
          latestPage.page >= latestUpdatesStopPage
        ) {
          return this.catalogSyncStatusService.updateStatus(status, {
            status: "completed",
          })
        }

        page += 1

        if (page <= totalPages) {
          await new Promise((resolve) => {
            setTimeout(resolve, CATALOG_SYNC_PAGE_WAIT_MS)
          })

          const pageWaitControl =
            await this.catalogSyncControlService.applyCatalogSyncControl(status)

          status = pageWaitControl.status

          if (pageWaitControl.isStopped) {
            return status
          }
        }
      }

      return this.catalogSyncStatusService.updateStatus(status, {
        status: "completed",
      })
    } catch (error) {
      const lastError = this.createCatalogSyncErrorMessage(error)

      return this.catalogSyncStatusService.updateStatus(status, {
        status: "failed",
        lastError,
      })
    }
  }

  private createCatalogSyncErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }

    if (typeof error === "string") {
      return error
    }

    try {
      return JSON.stringify(error)
    } catch {
      return "Catalog sync failed"
    }
  }

  private createSlug(name: string) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  private resolveObjectIds(
    f95Ids: number[],
    objectIdByF95Id: Map<number, Types.ObjectId>,
  ) {
    const objectIds: Types.ObjectId[] = []
    const knownF95Ids: number[] = []

    f95Ids.forEach((f95Id) => {
      const objectId = objectIdByF95Id.get(f95Id)

      if (objectId) {
        objectIds.push(objectId)
        knownF95Ids.push(f95Id)
      }
    })

    return {
      objectIds,
      knownF95Ids,
    }
  }

  private async recordUnknownIds(
    status: TCatalogSyncStatus,
    ids: {
      f95TagIds: number[]
      f95PrefixIds: number[]
      knownTagIds: number[]
      knownPrefixIds: number[]
    },
  ) {
    const unknownTagIds = ids.f95TagIds.filter((f95TagId) => {
      return !ids.knownTagIds.includes(f95TagId)
    })
    const unknownPrefixIds = ids.f95PrefixIds.filter((f95PrefixId) => {
      return !ids.knownPrefixIds.includes(f95PrefixId)
    })

    return this.catalogSyncStatusService.updateStatus(status, {
      unknownTagIds: Array.from(
        new Set([...status.unknownTagIds, ...unknownTagIds]),
      ),
      unknownPrefixIds: Array.from(
        new Set([...status.unknownPrefixIds, ...unknownPrefixIds]),
      ),
    })
  }
}

export { CatalogSyncRunnerService }
