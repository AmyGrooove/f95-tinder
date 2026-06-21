import type {
  GameListResponse,
  UserGameStatus,
} from '@f95/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

import { GameRepository } from '../../../entities/game/services/game.repository';
import type { UserGameStateRecord } from '../../../entities/userGameState/services/userGameState.repository';
import { UserGameStateRepository } from '../../../entities/userGameState/services/userGameState.repository';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { GameDecisionWriteBehindService } from '../../../infrastructure/database/services/gameDecisionWriteBehind.service';
import type { PendingGameDecision } from '../../../infrastructure/database/types/pendingGameDecision';
import { decodeCursor } from '../../../shared/functions/cursor/decodeCursor';
import {
  encodeCursor,
  type CursorValue,
} from '../../../shared/functions/cursor/encodeCursor';
import { toGameDto } from '../../../shared/functions/game/toGameDto';
import {
  DeleteGameStatusResponseDto,
  UpdateGameStatusResponseDto,
} from '../dto/updateGameStatusBody.dto';

const LIST_CACHE_TTL_SECONDS = 5 * 60;

@Injectable()
export class ListsService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly userGameStateRepository: UserGameStateRepository,
    private readonly writeBehindService: GameDecisionWriteBehindService,
    private readonly cacheService: CacheService,
  ) {}

  async getList(
    userId: string,
    status: UserGameStatus,
    limit: number,
    cursor?: string,
  ): Promise<GameListResponse> {
    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    const cacheKey = await this.listCacheKey(
      userId,
      status,
      limit,
      cursor,
    );
    const cached =
      await this.cacheService.getJson<GameListResponse>(cacheKey);

    if (cached) {
      return cached;
    }

    const pendingBefore =
      await this.writeBehindService.findPendingByUser(userId);
    const initialStates = await this.findPageStates(
      userId,
      status,
      limit,
      decodedCursor,
      pendingBefore,
    );
    const pendingAfter =
      await this.writeBehindService.findPendingByUser(userId);
    const pending = this.mergePending(pendingBefore, pendingAfter);
    const states = this.pendingSnapshotsMatch(
      pendingBefore,
      pendingAfter,
    )
      ? initialStates
      : await this.findPageStates(
          userId,
          status,
          limit,
          decodedCursor,
          pending,
        );
    const pageStates = states.slice(0, limit);
    const hasNextPage = states.length > limit;
    const games = await this.gameRepository.findByIds(
      pageStates.map((state) => state.gameId),
    );
    const gamesById = new Map(
      games.map((game) => [String(game._id), game]),
    );
    const items = pageStates.flatMap((state) => {
      const game = gamesById.get(state.gameId);

      return game
        ? [{
            game: toGameDto(game),
            status,
            updatedAt: state.updatedAt.toISOString(),
          }]
        : [];
    });
    const lastState = pageStates.at(-1);
    const response: GameListResponse = {
      items,
      nextCursor:
        hasNextPage && lastState
          ? encodeCursor({
              updatedAt: lastState.updatedAt.toISOString(),
              id: lastState.gameId,
            })
          : null,
    };

    await this.cacheService.setJson(
      cacheKey,
      response,
      LIST_CACHE_TTL_SECONDS,
    );

    return response;
  }

  async updateStatus(
    userId: string,
    gameId: string,
    status: UserGameStatus,
  ): Promise<UpdateGameStatusResponseDto> {
    await this.assertGameExists(gameId);
    const decision = await this.writeBehindService.recordDecision(
      userId,
      gameId,
      { operation: 'set', status },
    );

    return {
      gameId,
      status,
      updatedAt: decision.updatedAt,
    };
  }

  async deleteStatus(
    userId: string,
    gameId: string,
  ): Promise<DeleteGameStatusResponseDto> {
    await this.assertGameExists(gameId);
    await this.writeBehindService.recordDecision(
      userId,
      gameId,
      { operation: 'delete' },
    );

    return {
      gameId,
      deleted: true,
    };
  }

  private async assertGameExists(gameId: string): Promise<void> {
    if (await this.gameRepository.findById(gameId)) {
      return;
    }

    throw new NotFoundException({
      statusCode: 404,
      code: 'game_not_found',
      message: 'The requested game does not exist',
    });
  }

  private compareStates(
    left: UserGameStateRecord,
    right: UserGameStateRecord,
  ): number {
    const dateComparison =
      right.updatedAt.getTime() - left.updatedAt.getTime();

    return dateComparison !== 0
      ? dateComparison
      : right.gameId.localeCompare(left.gameId);
  }

  private async findPageStates(
    userId: string,
    status: UserGameStatus,
    limit: number,
    cursor: CursorValue | null,
    pending: PendingGameDecision[],
  ): Promise<UserGameStateRecord[]> {
    const pendingByGameId = new Map(
      pending.map((decision) => [decision.gameId, decision]),
    );
    const merged = new Map<string, UserGameStateRecord>();

    for (const decision of pending) {
      if (
        decision.operation === 'set' &&
        decision.status === status
      ) {
        const state = this.toState(decision);

        if (cursor === null || this.isAfterCursor(state, cursor)) {
          merged.set(state.gameId, state);
        }
      }
    }

    let mongoCursor = cursor;
    let hasMoreMongo = true;

    do {
      const records =
        await this.userGameStateRepository.findPageByUserAndStatus(
          userId,
          status,
          limit,
          mongoCursor,
        );

      hasMoreMongo = records.length > limit;

      for (const state of records) {
        const decision = pendingByGameId.get(state.gameId);

        if (!decision || state.version >= decision.version) {
          merged.set(state.gameId, state);
        }
      }

      const lastState = records.at(-1);

      if (!lastState) {
        break;
      }

      mongoCursor = {
        updatedAt: lastState.updatedAt.toISOString(),
        id: lastState.gameId,
      };
    } while (merged.size <= limit && hasMoreMongo);

    return [...merged.values()]
      .sort((left, right) => this.compareStates(left, right))
      .slice(0, limit + 1);
  }

  private mergePending(
    before: PendingGameDecision[],
    after: PendingGameDecision[],
  ): PendingGameDecision[] {
    const merged = new Map<string, PendingGameDecision>();

    for (const decision of [...before, ...after]) {
      const current = merged.get(decision.gameId);

      if (!current || decision.version > current.version) {
        merged.set(decision.gameId, decision);
      }
    }

    return [...merged.values()];
  }

  private pendingSnapshotsMatch(
    before: PendingGameDecision[],
    after: PendingGameDecision[],
  ): boolean {
    if (before.length !== after.length) {
      return false;
    }

    const afterByGameId = new Map(
      after.map((decision) => [decision.gameId, decision]),
    );

    return before.every((decision) => {
      const current = afterByGameId.get(decision.gameId);

      return (
        current?.version === decision.version &&
        current.operation === decision.operation
      );
    });
  }

  private toState(
    decision: Extract<PendingGameDecision, { operation: 'set' }>,
  ): UserGameStateRecord {
    return {
      gameId: decision.gameId,
      status: decision.status,
      updatedAt: new Date(decision.updatedAt),
      version: decision.version,
    };
  }

  private isAfterCursor(
    state: UserGameStateRecord,
    cursor: { updatedAt: string; id: string },
  ): boolean {
    const stateTime = state.updatedAt.getTime();
    const cursorTime = new Date(cursor.updatedAt).getTime();

    return (
      stateTime < cursorTime ||
      (stateTime === cursorTime && state.gameId < cursor.id)
    );
  }

  private async listCacheKey(
    userId: string,
    status: UserGameStatus,
    limit: number,
    cursor?: string,
  ): Promise<string> {
    const version =
      (await this.cacheService.getJson<number>(
        this.listVersionKey(userId),
      )) ?? 0;

    return [
      'lists',
      userId,
      version,
      status,
      limit,
      cursor ?? 'first',
    ].join(':');
  }

  private listVersionKey(userId: string): string {
    return `lists:version:${userId}`;
  }
}
