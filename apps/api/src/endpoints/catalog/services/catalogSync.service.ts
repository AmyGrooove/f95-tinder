import { Injectable } from '@nestjs/common';

import type { CatalogSyncPhase } from '@f95/contracts';

import { GameRepository } from '../../../entities/game/services/game.repository';
import type { SyncStateDocument } from '../../../entities/syncState/schemas/syncState.schema';
import { SyncStateRepository } from '../../../entities/syncState/services/syncState.repository';
import { normalizeF95Game } from '../../../integrations/f95/functions/normalizeF95Game';
import { F95LatestClient } from '../../../integrations/f95/services/f95Latest.client';
import { CatalogSyncProgressService } from './catalogSyncProgress.service';

export type CatalogSyncKind = 'initial' | 'daily';

@Injectable()
export class CatalogSyncService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly syncStateRepository: SyncStateRepository,
    private readonly f95LatestClient: F95LatestClient,
    private readonly progressService: CatalogSyncProgressService,
  ) {}

  async run(kind: CatalogSyncKind): Promise<void> {
    const priorState = await this.syncStateRepository.getOrCreate();
    const phase: CatalogSyncPhase =
      kind === 'initial' ? 'initial-import' : 'daily-sync';
    const watermark =
      kind === 'daily' ? priorState.watermarkSourceTimestamp : null;
    const priorCheckpoint = priorState.checkpointPage;
    let processedGames = 0;
    let page = 1;
    let newestSourceTimestamp: Date | null = null;

    await this.save({
      $set: {
        phase,
        currentPage: 0,
        totalPages: null,
        processedGames: 0,
        startedAt: new Date(),
        nextRetryAt: null,
        lastError: null,
      },
    });

    while (true) {
      const response = await this.f95LatestClient.fetchPage(page);
      const importedAt = new Date();
      const games = response.msg.data.map((thread) =>
        normalizeF95Game(thread, importedAt),
      );

      await this.gameRepository.upsertPage(games);
      processedGames += games.length;
      newestSourceTimestamp = this.getNewestTimestamp(
        newestSourceTimestamp,
        games.map((game) => game.sourceUpdatedAt),
      );

      await this.save({
        $set: {
          phase,
          currentPage: page,
          totalPages: response.msg.pagination.total,
          processedGames,
          checkpointPage: page,
          nextRetryAt: null,
          lastError: null,
        },
      });

      const reachedWatermark =
        kind === 'daily' &&
        watermark !== null &&
        page >= priorCheckpoint &&
        games.length > 0 &&
        games.every((game) => game.sourceUpdatedAt <= watermark);
      const reachedFinalPage =
        response.msg.pagination.total === 0 ||
        page >= response.msg.pagination.total;

      if (reachedWatermark || reachedFinalPage) {
        break;
      }

      page += 1;
    }

    await this.save({
      $set: {
        phase: 'completed',
        checkpointPage: 0,
        retryAttempt: 0,
        watermarkSourceTimestamp:
          newestSourceTimestamp ?? watermark ?? new Date(),
        lastSuccessfulSyncAt: new Date(),
        nextRetryAt: null,
        lastError: null,
      },
    });
  }

  async markRetry(
    error: unknown,
    retryAttempt: number,
    nextRetryAt: Date,
  ): Promise<void> {
    await this.save({
      $set: {
        phase: 'retrying',
        retryAttempt,
        nextRetryAt,
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
  }

  private async save(update: Parameters<SyncStateRepository['update']>[0]) {
    const state = await this.syncStateRepository.update(update);
    this.progressService.publish(state);
    return state;
  }

  private getNewestTimestamp(
    current: Date | null,
    timestamps: Date[],
  ): Date | null {
    return timestamps.reduce<Date | null>(
      (newest, timestamp) =>
        newest === null || timestamp > newest ? timestamp : newest,
      current,
    );
  }
}
