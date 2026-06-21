import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import type { PendingGameDecision } from '../../../infrastructure/database/types/pendingGameDecision';
import type { CursorValue } from '../../../shared/functions/cursor/encodeCursor';
import {
  UserGameState,
  type UserGameStateDocument,
} from '../schemas/userGameState.schema';

export interface UserGameStateRecord {
  gameId: string;
  status: UserGameState['status'];
  updatedAt: Date;
  version: number;
}

@Injectable()
export class UserGameStateRepository {
  constructor(
    @InjectModel(UserGameState.name)
    private readonly userGameStateModel: Model<UserGameState>,
  ) {}

  async applyPending(
    userId: string,
    decisions: PendingGameDecision[],
  ): Promise<void> {
    if (decisions.length === 0) {
      return;
    }

    const setOperations = decisions
      .filter(
        (decision): decision is Extract<
          PendingGameDecision,
          { operation: 'set' }
        > => decision.operation === 'set',
      )
      .map((decision) => {
        const updatedAt = new Date(decision.updatedAt);
        const shouldApply = {
          $lt: [{ $ifNull: ['$version', 0] }, decision.version],
        };

        return {
          updateOne: {
            filter: { userId, gameId: decision.gameId },
            update: [
              {
                $set: {
                  status: { $cond: [shouldApply, decision.status, '$status'] },
                  version: {
                    $cond: [shouldApply, decision.version, '$version'],
                  },
                  updatedAt: {
                    $cond: [shouldApply, updatedAt, '$updatedAt'],
                  },
                  createdAt: { $ifNull: ['$createdAt', updatedAt] },
                },
              },
            ],
            upsert: true,
            timestamps: false,
          },
        };
      });
    const deleteOperations = decisions
      .filter(
        (decision): decision is Extract<
          PendingGameDecision,
          { operation: 'delete' }
        > => decision.operation === 'delete',
      )
      .map((decision) => ({
        deleteOne: {
          filter: {
            userId,
            gameId: decision.gameId,
            version: { $lt: decision.version },
          },
        },
      }));

    // Flushes may race newer decisions: sets mutate only older versions,
    // deletes match only older versions, and Redis cleanup checks exact
    // pending versions separately.
    await this.userGameStateModel.bulkWrite(
      [...setOperations, ...deleteOperations],
      { ordered: false },
    );
  }

  async findByUser(userId: string): Promise<UserGameStateRecord[]> {
    const states = await this.userGameStateModel
      .find({ userId })
      .select({ gameId: 1, status: 1, updatedAt: 1, version: 1 })
      .lean()
      .exec();

    return states.map((state) => ({
      gameId: String(state.gameId),
      status: state.status,
      updatedAt: state.updatedAt,
      version: state.version,
    }));
  }

  async findPageByUserAndStatus(
    userId: string,
    status: UserGameState['status'],
    limit: number,
    cursor: CursorValue | null,
  ): Promise<UserGameStateRecord[]> {
    const cursorPredicate = cursor
      ? {
          $or: [
            { updatedAt: { $lt: new Date(cursor.updatedAt) } },
            {
              updatedAt: new Date(cursor.updatedAt),
              gameId: { $lt: new Types.ObjectId(cursor.id) },
            },
          ],
        }
      : {};
    const states = await this.userGameStateModel
      .find({ userId, status, ...cursorPredicate })
      .select({ gameId: 1, status: 1, updatedAt: 1, version: 1 })
      .sort({ updatedAt: -1, gameId: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    return states.map((state) => ({
      gameId: String(state.gameId),
      status: state.status,
      updatedAt: state.updatedAt,
      version: state.version,
    }));
  }

  findByUserAndGame(
    userId: string,
    gameId: string,
  ): Promise<UserGameStateDocument | null> {
    return this.userGameStateModel.findOne({ userId, gameId }).exec();
  }
}
