import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, UpdateQuery } from 'mongoose';

import {
  SyncState,
  type SyncStateDocument,
} from '../schemas/syncState.schema';

export const F95_SYNC_SOURCE = 'f95-latest';

@Injectable()
export class SyncStateRepository {
  constructor(
    @InjectModel(SyncState.name)
    private readonly syncStateModel: Model<SyncState>,
  ) {}

  getOrCreate(): Promise<SyncStateDocument> {
    return this.syncStateModel
      .findOneAndUpdate(
        { source: F95_SYNC_SOURCE },
        { $setOnInsert: { source: F95_SYNC_SOURCE } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .orFail()
      .exec();
  }

  update(
    update: UpdateQuery<SyncState>,
  ): Promise<SyncStateDocument> {
    return this.syncStateModel
      .findOneAndUpdate(
        { source: F95_SYNC_SOURCE },
        update,
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .orFail()
      .exec();
  }
}
