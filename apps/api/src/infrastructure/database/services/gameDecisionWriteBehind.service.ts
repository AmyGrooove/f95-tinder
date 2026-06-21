import type { UserGameStatus } from '@f95/contracts';
import { Injectable } from '@nestjs/common';

import type { UserGameStateRecord } from '../../../entities/userGameState/services/userGameState.repository';
import { UserGameStateRepository } from '../../../entities/userGameState/services/userGameState.repository';
import { CacheService } from '../../cache/cache.service';
import type {
  GameDecisionOperation,
  PendingGameDecision,
} from '../types/pendingGameDecision';

const DIRTY_USERS_KEY = 'game-decisions:dirty-users';
const UNDO_TTL_SECONDS = 10 * 60;

type UndoState =
  | { kind: 'absent' }
  | {
      kind: 'present';
      status: UserGameStatus;
      updatedAt: string;
      version: number;
    };

export type UndoDecisionResult =
  | { kind: 'applied'; decision: PendingGameDecision }
  | { kind: 'conflict' }
  | { kind: 'unavailable' };

const RECORD_DECISION_SCRIPT = `
  local pending = redis.call('HGET', KEYS[1], ARGV[1])
  local latest = redis.call('HGET', KEYS[5], ARGV[1])
  local knownVersion = tonumber(redis.call('GET', KEYS[4])) or 0
  local previous = { kind = 'absent' }
  local previousVersion = 0

  local function decisionToUndoState(serialized)
    local decision = cjson.decode(serialized)

    if decision.operation == 'delete' or decision.status == cjson.null then
      return { kind = 'absent' }
    end

    return {
      kind = 'present',
      status = decision.status,
      updatedAt = decision.updatedAt,
      version = decision.version
    }
  end

  local function considerDecision(serialized)
    if not serialized then
      return
    end

    local version = tonumber(cjson.decode(serialized).version) or 0
    knownVersion = math.max(knownVersion, version)

    if version >= previousVersion then
      previous = decisionToUndoState(serialized)
      previousVersion = version
    end
  end

  if ARGV[2] ~= '' then
    local persisted = cjson.decode(ARGV[2])

    if persisted.kind == 'present' then
      previous = persisted
      previousVersion = tonumber(persisted.version) or 0
      knownVersion = math.max(knownVersion, previousVersion)
    end
  end

  considerDecision(latest)
  considerDecision(pending)
  redis.call('SET', KEYS[4], knownVersion)

  local version = redis.call('INCR', KEYS[4])
  local requested = cjson.decode(ARGV[3])
  local decision = {
    gameId = ARGV[1],
    operation = requested.operation,
    updatedAt = ARGV[4],
    version = version
  }

  if requested.operation == 'set' then
    decision.status = requested.status
  end

  local undo = {
    gameId = ARGV[1],
    previous = previous,
    decisionVersion = version
  }
  local serialized = cjson.encode(decision)

  redis.call('HSET', KEYS[1], ARGV[1], serialized)
  redis.call('HSET', KEYS[5], ARGV[1], serialized)
  redis.call('SET', KEYS[2], cjson.encode(undo), 'EX', ARGV[6])
  redis.call('SADD', KEYS[3], ARGV[5])

  return serialized
`;

const UNDO_DECISION_SCRIPT = `
  local function normalizeUndoState(previous)
    if not previous or previous == cjson.null then
      return { kind = 'absent' }
    end

    if previous.kind == 'absent' or previous.kind == 'present' then
      return previous
    end

    if previous.operation == 'delete' or previous.status == cjson.null then
      return { kind = 'absent' }
    end

    return {
      kind = 'present',
      status = previous.status,
      updatedAt = previous.updatedAt,
      version = previous.version
    }
  end

  local serializedUndo = redis.call('GET', KEYS[2])

  if not serializedUndo then
    return cjson.encode({ kind = 'unavailable' })
  end

  local undo = cjson.decode(serializedUndo)
  local previous = normalizeUndoState(undo.previous)
  local pending = redis.call('HGET', KEYS[1], undo.gameId)
  local latest = redis.call('HGET', KEYS[5], undo.gameId)
  local knownVersion = tonumber(redis.call('GET', KEYS[4])) or 0

  if not latest and pending then
    latest = pending
    redis.call('HSET', KEYS[5], undo.gameId, pending)
  end

  if not latest then
    return cjson.encode({ kind = 'conflict' })
  end

  local currentDecision = cjson.decode(latest)

  if currentDecision.version ~= undo.decisionVersion then
    return cjson.encode({ kind = 'conflict' })
  end

  if pending then
    local pendingDecision = cjson.decode(pending)

    if pendingDecision.version ~= undo.decisionVersion
      or pending ~= latest then
      return cjson.encode({ kind = 'conflict' })
    end
  end

  knownVersion = math.max(knownVersion, currentDecision.version)
  knownVersion = math.max(knownVersion, undo.decisionVersion)
  redis.call('SET', KEYS[4], knownVersion)
  local version = redis.call('INCR', KEYS[4])
  local restored = {
    gameId = undo.gameId,
    operation = previous.kind == 'present'
      and 'set'
      or 'delete',
    updatedAt = ARGV[1],
    version = version
  }

  if previous.kind == 'present' then
    restored.status = previous.status
  end

  local serialized = cjson.encode(restored)

  redis.call('HSET', KEYS[1], undo.gameId, serialized)
  redis.call('HSET', KEYS[5], undo.gameId, serialized)
  redis.call('DEL', KEYS[2])
  redis.call('SADD', KEYS[3], ARGV[2])

  return cjson.encode({
    kind = 'applied',
    decision = restored
  })
`;

const CLEAN_PERSISTED_SCRIPT = `
  for index = 1, #ARGV, 2 do
    local field = ARGV[index]
    local expectedVersion = tonumber(ARGV[index + 1])
    local current = redis.call('HGET', KEYS[1], field)

    if current then
      local decision = cjson.decode(current)

      if decision.version == expectedVersion then
        local latest = redis.call('HGET', KEYS[4], field)

        if not latest
          or tonumber(cjson.decode(latest).version) < expectedVersion then
          redis.call('HSET', KEYS[4], field, current)
        end

        redis.call('HDEL', KEYS[1], field)
      end
    end
  end

  if redis.call('HLEN', KEYS[1]) == 0 then
    redis.call('SREM', KEYS[2], KEYS[3])
  end

  return 1
`;

@Injectable()
export class GameDecisionWriteBehindService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly userGameStateRepository: UserGameStateRepository,
  ) {}

  async recordDecision(
    userId: string,
    gameId: string,
    operation: GameDecisionOperation,
  ): Promise<PendingGameDecision> {
    const persisted = await this.userGameStateRepository.findByUserAndGame(
      userId,
      gameId,
    );
    const persistedDecision = persisted
      ? this.toPendingDecision(persisted)
      : null;
    const serialized = await this.cacheService.executeScript<string>(
      RECORD_DECISION_SCRIPT,
      [
        this.pendingKey(userId),
        this.undoKey(userId),
        DIRTY_USERS_KEY,
        this.versionKey(userId),
        this.latestKey(userId),
      ],
      [
        gameId,
        persistedDecision
          ? JSON.stringify(this.toUndoState(persistedDecision))
          : '',
        JSON.stringify(operation),
        new Date().toISOString(),
        userId,
        UNDO_TTL_SECONDS,
      ],
    );

    const decision = JSON.parse(serialized) as PendingGameDecision;

    await this.invalidateReadCaches(userId);

    return decision;
  }

  async undo(userId: string): Promise<UndoDecisionResult> {
    const serialized = await this.cacheService.executeScript<string>(
      UNDO_DECISION_SCRIPT,
      [
        this.pendingKey(userId),
        this.undoKey(userId),
        DIRTY_USERS_KEY,
        this.versionKey(userId),
        this.latestKey(userId),
      ],
      [new Date().toISOString(), userId],
    );

    const result = JSON.parse(serialized) as
      | { kind: 'applied'; decision: PendingGameDecision }
      | { kind: 'conflict' }
      | { kind: 'unavailable' };

    if (result.kind !== 'applied') {
      return result;
    }

    await this.invalidateReadCaches(userId);

    return result;
  }

  async findMergedByUser(userId: string): Promise<UserGameStateRecord[]> {
    const pendingBefore = await this.getPending(userId);
    const persisted = await this.userGameStateRepository.findByUser(userId);
    const pendingAfter = await this.getPending(userId);
    const pending = new Map<string, PendingGameDecision>();

    for (const decision of [...pendingBefore, ...pendingAfter]) {
      const current = pending.get(decision.gameId);

      if (!current || decision.version > current.version) {
        pending.set(decision.gameId, decision);
      }
    }

    const merged = new Map(
      persisted.map((state) => [state.gameId, state]),
    );

    for (const decision of pending.values()) {
      const persistedState = merged.get(decision.gameId);

      if (
        persistedState &&
        persistedState.version >= decision.version
      ) {
        continue;
      }

      if (decision.operation === 'delete') {
        merged.delete(decision.gameId);
        continue;
      }

      merged.set(decision.gameId, {
        gameId: decision.gameId,
        status: decision.status,
        updatedAt: new Date(decision.updatedAt),
        version: decision.version,
      });
    }

    return [...merged.values()];
  }

  findPendingByUser(userId: string): Promise<PendingGameDecision[]> {
    return this.getPending(userId);
  }

  async flushDirtyUsers(): Promise<void> {
    const userIds = await this.cacheService.getSetMembers(DIRTY_USERS_KEY);

    for (const userId of userIds) {
      await this.flushUser(userId);
    }
  }

  private async flushUser(userId: string): Promise<void> {
    const pending = await this.getPending(userId);

    if (pending.length === 0) {
      await this.cacheService.executeScript<number>(
        CLEAN_PERSISTED_SCRIPT,
        [
          this.pendingKey(userId),
          DIRTY_USERS_KEY,
          userId,
          this.latestKey(userId),
        ],
        [],
      );
      return;
    }

    await this.userGameStateRepository.applyPending(userId, pending);
    await this.cacheService.executeScript<number>(
      CLEAN_PERSISTED_SCRIPT,
      [
        this.pendingKey(userId),
        DIRTY_USERS_KEY,
        userId,
        this.latestKey(userId),
      ],
      pending.flatMap((decision) => [
        decision.gameId,
        decision.version,
      ]),
    );
  }

  private async getPending(userId: string): Promise<PendingGameDecision[]> {
    const pending =
      await this.cacheService.getHashJsonAll<
        PendingGameDecision | LegacyPendingGameDecision
      >(
        this.pendingKey(userId),
      );

    return Object.values(pending).map((decision) =>
      this.normalizePendingDecision(decision),
    );
  }

  private normalizePendingDecision(
    decision: PendingGameDecision | LegacyPendingGameDecision,
  ): PendingGameDecision {
    if ('operation' in decision) {
      return decision;
    }

    return decision.status === null
      ? {
          operation: 'delete',
          gameId: decision.gameId,
          updatedAt: decision.updatedAt,
          version: decision.version,
        }
      : {
          operation: 'set',
          gameId: decision.gameId,
          status: decision.status,
          updatedAt: decision.updatedAt,
          version: decision.version,
        };
  }

  private toPendingDecision(
    state: UserGameStateDocumentLike,
  ): PendingGameDecision {
    return {
      operation: 'set',
      gameId: String(state.gameId),
      status: state.status,
      updatedAt: state.updatedAt.toISOString(),
      version: state.version,
    };
  }

  private toUndoState(decision: PendingGameDecision): UndoState {
    if (decision.operation === 'delete') {
      return { kind: 'absent' };
    }

    return {
      kind: 'present',
      status: decision.status,
      updatedAt: decision.updatedAt,
      version: decision.version,
    };
  }

  private pendingKey(userId: string): string {
    return `game-decisions:pending:${userId}`;
  }

  private undoKey(userId: string): string {
    return `game-decisions:undo:${userId}`;
  }

  private versionKey(userId: string): string {
    return `game-decisions:version:${userId}`;
  }

  private latestKey(userId: string): string {
    return `game-decisions:latest:${userId}`;
  }

  private async invalidateReadCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.increment(this.swipeQueueVersionKey(userId)),
      this.cacheService.increment(`lists:version:${userId}`),
    ]);
  }

  private swipeQueueVersionKey(userId: string): string {
    return `swipe:queue:version:${userId}`;
  }
}

type UserGameStateDocumentLike = Pick<
  UserGameStateRecord,
  'gameId' | 'status' | 'updatedAt' | 'version'
>;

interface LegacyPendingGameDecision {
  gameId: string;
  status: UserGameStatus | null;
  updatedAt: string;
  version: number;
}
