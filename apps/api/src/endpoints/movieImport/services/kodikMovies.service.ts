import { Injectable, NotFoundException } from "@nestjs/common"
import type { Types } from "mongoose"

import { BannedItemRepository } from "@entities/bannedItem/services/bannedItem.repository"
import { FeatureRepository } from "@entities/feature/services/feature.repository"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemRepository } from "@entities/item/services/item.repository"
import { matchItemFeature } from "@entities/itemFeature/functions/matchItemFeature"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { KodikService } from "@entities/source/services/kodik.service"
import { PageCollectorService } from "@entities/source/services/pageCollector.service"
import { SourceDataWriterService } from "@entities/source/services/sourceDataWriter.service"
import type {
  IKodikMaterial,
  IKodikPage,
} from "@entities/source/types/IKodikResponse"
import { withSourceItems } from "@entities/sourceItem/functions/withSourceItems"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { JobService } from "@infrastructure/jobs/services/job.service"
import { NonRetryableJobError } from "@infrastructure/jobs/errors/NonRetryableJobError"
import type { JobContext } from "@infrastructure/jobs/types/JobContext"
import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

import type { KodikMovieCollectionResponseDto } from "../dto/response/kodikMovieCollection.response"
import { COLLECT_NEW_KODIK_MOVIES_JOB } from "../static/COLLECT_NEW_KODIK_MOVIES_JOB"
import { KODIK_MOVIES_SETTINGS } from "../static/KODIK_MOVIES_SETTINGS"
import type { IKodikMovieCollectionContext } from "../types/IKodikMovieCollectionContext"
import type { IKodikMovieIdentity } from "../types/IKodikMovieIdentity"

@Injectable()
class KodikMoviesService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly featureRepository: FeatureRepository,
    private readonly bannedItemRepository: BannedItemRepository,
    private readonly jobService: JobService,
    private readonly pageCollectorService: PageCollectorService,
    private readonly kodikService: KodikService,
    private readonly sourceDataWriterService: SourceDataWriterService,
  ) {}

  async start() {
    await this.kodikService.getSource()

    const id = await this.jobService.add(
      COLLECT_NEW_KODIK_MOVIES_JOB,
      {},
      { deduplication: { id: COLLECT_NEW_KODIK_MOVIES_JOB.name } },
    )

    return this.getStatus(id)
  }

  async getStatus(id: string): Promise<KodikMovieCollectionResponseDto> {
    const job = await this.jobService.get(id)

    if (isNil(job) || job.name !== COLLECT_NEW_KODIK_MOVIES_JOB.name) {
      throw new NotFoundException(DICTIONARY.kodikMovies.jobNotFound)
    }

    return {
      id: job.id,
      state: job.state,
      progress: job.progress,
      attempt: job.attempt,
      storagePath: this.sourceDataWriterService.getStoragePath({
        sourceKey: KODIK_MOVIES_SETTINGS.sourceKey,
        scope: KODIK_MOVIES_SETTINGS.scope,
        context: { id: job.id, attempt: Math.max(1, job.attempt) },
      }),
      createdAt: job.createdAt,
      status: job.status,
      failedReason: job.failedReason,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    }
  }

  async collect(context: JobContext) {
    const source = await this.kodikService.getSource()
    const { importedIds, announcedIds } = await this.getImportedIds(source._id)
    const storagePath = this.sourceDataWriterService.getStoragePath({
      sourceKey: KODIK_MOVIES_SETTINGS.sourceKey,
      scope: KODIK_MOVIES_SETTINGS.scope,
      context,
    })
    const startedAt = new Date().toISOString()
    const collection: IKodikMovieCollectionContext = {
      context,
      sourceId: source._id,
      storagePath,
      savedIds: new Set<string>(),
    }
    const newMovies = await this.collectNewMovies(collection, importedIds)
    const announcements = await this.collectAnnouncements(
      collection,
      announcedIds,
    )
    const savedPages = newMovies.savedPages + announcements.savedPages
    const savedRecords = newMovies.savedRecords + announcements.savedRecords

    await context.throwIfCancelled()

    const manifest = {
      source: KODIK_MOVIES_SETTINGS.sourceKey,
      sourceId: source._id.toString(),
      itemType: EItemType.MOVIE,
      mode: "new",
      state: "completed",
      startedAt,
      finishedAt: new Date().toISOString(),
      parameters: {
        ...Object.fromEntries(
          Object.entries(KODIK_MOVIES_SETTINGS.parameters).map(
            ([key, value]) => [key, String(value)],
          ),
        ),
        sort: "created_at",
        order: "desc",
      },
      excludedGenres: KODIK_MOVIES_SETTINGS.excludedGenres,
      matchedExternalId: newMovies.matchedExternalId,
      listedPages: newMovies.listedPages,
      savedPages,
      savedRecords,
      announcementRequests: announcements.announcementRequests,
    }

    await this.sourceDataWriterService.writeManifest({ storagePath, manifest })
    await context.updateProgress({
      progress: 100,
      status: DICTIONARY.kodikMovies.completed,
    })

    return { storagePath, savedPages, savedRecords }
  }

  private async collectNewMovies(
    collection: IKodikMovieCollectionContext,
    importedIds: Set<string>,
  ) {
    const { context, sourceId, storagePath, savedIds } = collection
    let matchedExternalId: string | null = null
    let listedPages = 0
    let savedPages = 0
    let savedRecords = 0

    await context.updateProgress({
      progress: 0,
      status: DICTIONARY.kodikMovies.collecting,
    })

    await this.pageCollectorService.collect<string | undefined, IKodikPage>({
      context,
      initialState: undefined,
      getStateKey: (nextPage) => nextPage ?? "initial",
      fetchPage: (nextPage) => {
        return this.kodikService.list(
          {
            ...KODIK_MOVIES_SETTINGS.parameters,
            sort: "created_at",
            order: "desc",
          },
          nextPage,
        )
      },
      processPage: async (page) => {
        listedPages += 1

        const matchIndex = page.results.findIndex((record) => {
          return importedIds.has(record.id)
        })
        const candidates =
          matchIndex < 0 ? page.results : page.results.slice(0, matchIndex)
        const records = await this.filterRecords(candidates, sourceId)
        const unsavedRecords = records.filter(
          (record) => !savedIds.has(record.id),
        )

        if (unsavedRecords.length > 0) {
          await context.throwIfCancelled()
          await this.sourceDataWriterService.writePage({
            storagePath,
            section: "pages",
            pageNumber: listedPages,
            body: this.kodikService.serializePage({
              ...page,
              results: unsavedRecords,
            }),
          })

          savedPages += 1
          savedRecords += unsavedRecords.length
          unsavedRecords.forEach((record) => savedIds.add(record.id))
        }

        await context.updateProgress({
          progress: 0,
          status: `${DICTIONARY.kodikMovies.collecting}: ${listedPages} стр., ${savedRecords} записей`,
        })

        if (matchIndex >= 0) {
          matchedExternalId = page.results[matchIndex].id
        }

        return { isContinuing: matchIndex < 0 }
      },
      getNextState: (page) => {
        const nextPage = page.next_page ?? undefined

        if (!isNil(nextPage) && page.results.length === 0) {
          throw new NonRetryableJobError(DICTIONARY.kodikMovies.repeatedPage)
        }

        return nextPage
      },
    })

    return { matchedExternalId, listedPages, savedPages, savedRecords }
  }

  private async collectAnnouncements(
    collection: IKodikMovieCollectionContext,
    announcedIds: string[],
  ) {
    const { context, sourceId, storagePath, savedIds } = collection
    const pendingAnnouncements = announcedIds.filter((id) => !savedIds.has(id))
    let announcementRequests = 0
    let savedPages = 0
    let savedRecords = 0

    await context.updateProgress({
      progress: 90,
      status: DICTIONARY.kodikMovies.announcements,
    })

    for (const id of pendingAnnouncements) {
      await context.throwIfCancelled()

      const page = await this.kodikService.findById(
        id,
        KODIK_MOVIES_SETTINGS.parameters,
      )
      const records = await this.filterRecords(
        page.results.filter((record) => record.id === id),
        sourceId,
      )
      announcementRequests += 1

      if (records.length > 0) {
        await context.throwIfCancelled()
        await this.sourceDataWriterService.writePage({
          storagePath,
          section: "announcements",
          pageNumber: announcementRequests,
          body: this.kodikService.serializePage({ ...page, results: records }),
        })

        savedPages += 1
        savedRecords += records.length
        records.forEach((record) => savedIds.add(record.id))
      }

      await context.updateProgress({
        progress:
          90 +
          Math.floor((announcementRequests / pendingAnnouncements.length) * 9),
        status: `${DICTIONARY.kodikMovies.announcements}: ${announcementRequests}/${pendingAnnouncements.length}`,
      })
    }

    return { announcementRequests, savedPages, savedRecords }
  }

  private async getImportedIds(sourceId: Types.ObjectId) {
    const importedPipeline = new AggregationBuilder()
      .match({ type: EItemType.MOVIE, deletedAt: null })
      .build()
    const projection = {
      _id: 0,
      externalIds: "$sourceItems.externalId",
    }
    const [latestMovies, statusFeature] = await Promise.all([
      this.itemRepository.aggregation.aggregate<IKodikMovieIdentity>(
        new AggregationBuilder()
          .use(...importedPipeline)
          .sort({ createdAt: -1, _id: -1 })
          .use(...withSourceItems(sourceId))
          .limit(KODIK_MOVIES_SETTINGS.importedMoviesLimit)
          .project(projection)
          .build(),
      ),
      this.featureRepository.read.findOne({ key: "releaseStatus" }),
    ])
    const announcedMovies = isNil(statusFeature)
      ? []
      : await this.itemRepository.aggregation.aggregate<IKodikMovieIdentity>(
          new AggregationBuilder()
            .use(...importedPipeline)
            .use(...withSourceItems(sourceId))
            .use(
              ...matchItemFeature({
                featureId: statusFeature._id,
                value: "anons",
              }),
            )
            .project(projection)
            .build(),
        )

    return {
      importedIds: new Set(latestMovies.flatMap((movie) => movie.externalIds)),
      announcedIds: [
        ...new Set(announcedMovies.flatMap((movie) => movie.externalIds)),
      ],
    }
  }

  private async filterRecords(
    records: IKodikMaterial[],
    source: Types.ObjectId,
  ) {
    const seenIds = new Set<string>()
    const movies = records.filter((record) => {
      if (!this.checkIsMovie(record) || seenIds.has(record.id)) {
        return false
      }

      seenIds.add(record.id)

      return true
    })

    if (movies.length === 0) {
      return []
    }

    const banned = await this.bannedItemRepository.read.findMany(
      { source, externalId: { $in: movies.map((record) => record.id) } },
      { externalId: 1 },
    )
    const bannedIds = new Set(banned.map((record) => record.externalId))

    return movies.filter((record) => !bannedIds.has(record.id))
  }

  private checkIsMovie(record: IKodikMaterial) {
    if (record.type !== "foreign-movie" && record.type !== "russian-movie") {
      return false
    }

    const metadata = record.material_data
    const genres = [
      metadata?.genres,
      metadata?.all_genres,
      metadata?.anime_genres,
      metadata?.drama_genres,
    ].flatMap((value) => (isArray(value) ? value.filter(isString) : []))
    const isExcludedGenre = genres.some((genre) => {
      return KODIK_MOVIES_SETTINGS.excludedGenres.some((excluded) => {
        return genre.trim().toLowerCase() === excluded
      })
    })
    const isAnimeKind =
      isString(metadata?.anime_kind) && metadata.anime_kind.trim() !== ""

    return !isExcludedGenre && !isAnimeKind
  }
}

export { KodikMoviesService }
