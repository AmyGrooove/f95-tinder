import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';

import { Game, type GameDocument } from '../schemas/game.schema';

export type UpsertGame = Pick<
  Game,
  | 'f95ThreadId'
  | 'title'
  | 'creator'
  | 'version'
  | 'views'
  | 'likes'
  | 'rating'
  | 'tagIds'
  | 'prefixIds'
  | 'coverUrl'
  | 'screenshotUrls'
  | 'publishedAt'
  | 'sourceUpdatedAt'
  | 'importedAt'
>;

@Injectable()
export class GameRepository {
  constructor(
    @InjectModel(Game.name)
    private readonly gameModel: Model<Game>,
  ) {}

  async upsertPage(games: UpsertGame[]): Promise<void> {
    if (games.length === 0) {
      return;
    }

    await this.gameModel.bulkWrite(
      games.map((game) => ({
        updateOne: {
          filter: { f95ThreadId: game.f95ThreadId },
          update: {
            $set: game,
            $setOnInsert: { createdAt: game.importedAt },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  findByF95ThreadId(f95ThreadId: number): Promise<GameDocument | null> {
    return this.gameModel.findOne({ f95ThreadId }).exec();
  }

  findById(gameId: string): Promise<GameDocument | null> {
    if (!isValidObjectId(gameId)) {
      return Promise.resolve(null);
    }

    return this.gameModel.findById(gameId).exec();
  }

  findByIds(gameIds: string[]): Promise<GameDocument[]> {
    if (gameIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.gameModel.find({ _id: { $in: gameIds } }).exec();
  }

  findPopularExcluding(
    excludedGameIds: string[],
    limit: number,
  ): Promise<GameDocument[]> {
    return this.gameModel
      .find(
        excludedGameIds.length === 0
          ? {}
          : { _id: { $nin: excludedGameIds } },
      )
      .sort({ views: -1, _id: 1 })
      .limit(limit)
      .exec();
  }

  count(): Promise<number> {
    return this.gameModel.countDocuments().exec();
  }
}
