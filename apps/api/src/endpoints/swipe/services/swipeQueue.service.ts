import { SWIPE_QUEUE_SIZE } from '@f95/contracts';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { GameRepository } from '../../../entities/game/services/game.repository';
import { SyncStateRepository } from '../../../entities/syncState/services/syncState.repository';
import { GameDecisionWriteBehindService } from '../../../infrastructure/database/services/gameDecisionWriteBehind.service';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { toGameDto } from '../../../shared/functions/game/toGameDto';
import { SwipeQueueResponseDto } from '../dto/swipeQueueResponse.dto';

const SWIPE_QUEUE_TTL_SECONDS = 5 * 60;

@Injectable()
export class SwipeQueueService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly syncStateRepository: SyncStateRepository,
    private readonly writeBehindService: GameDecisionWriteBehindService,
    private readonly cacheService: CacheService,
  ) {}

  async getQueue(userId: string): Promise<SwipeQueueResponseDto> {
    await this.assertCatalogReady();
    const queueVersion =
      (await this.cacheService.getJson<number>(
        this.queueVersionKey(userId),
      )) ?? 0;
    const queueKey = this.queueKey(userId, queueVersion);

    const cached =
      await this.cacheService.getJson<SwipeQueueResponseDto>(
        queueKey,
      );

    if (cached) {
      return cached;
    }

    const states = await this.writeBehindService.findMergedByUser(userId);
    const games = await this.gameRepository.findPopularExcluding(
      states.map((state) => state.gameId),
      SWIPE_QUEUE_SIZE,
    );
    const response = {
      items: games.map(toGameDto),
    };

    await this.cacheService.setJson(
      queueKey,
      response,
      SWIPE_QUEUE_TTL_SECONDS,
    );

    return response;
  }

  private async assertCatalogReady(): Promise<void> {
    const syncState = await this.syncStateRepository.getOrCreate();

    if (syncState.lastSuccessfulSyncAt !== null) {
      return;
    }

    throw new ServiceUnavailableException({
      statusCode: 503,
      code: 'catalog_not_ready',
      message: 'The initial catalog import is not complete',
    });
  }

  private queueKey(userId: string, version: number): string {
    return `swipe:queue:${userId}:${version}`;
  }

  private queueVersionKey(userId: string): string {
    return `swipe:queue:version:${userId}`;
  }
}
