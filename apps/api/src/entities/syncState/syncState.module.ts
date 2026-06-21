import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SyncState, SyncStateSchema } from './schemas/syncState.schema';
import { SyncStateRepository } from './services/syncState.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SyncState.name, schema: SyncStateSchema },
    ]),
  ],
  providers: [SyncStateRepository],
  exports: [SyncStateRepository],
})
export class SyncStateModule {}
