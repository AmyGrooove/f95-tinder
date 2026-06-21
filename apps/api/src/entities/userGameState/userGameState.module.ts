import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CacheModule } from '../../infrastructure/cache/cache.module';
import { GameDecisionWriteBehindService } from '../../infrastructure/database/services/gameDecisionWriteBehind.service';
import { JobsModule } from '../../infrastructure/jobs/jobs.module';
import { GameDecisionFlushProcessor } from '../../infrastructure/jobs/processors/gameDecisionFlush.processor';
import { GameDecisionFlushScheduler } from '../../infrastructure/scheduler/gameDecisionFlush.scheduler';
import {
  UserGameState,
  UserGameStateSchema,
} from './schemas/userGameState.schema';
import { UserGameStateRepository } from './services/userGameState.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserGameState.name, schema: UserGameStateSchema },
    ]),
    CacheModule,
    JobsModule,
  ],
  providers: [
    UserGameStateRepository,
    GameDecisionWriteBehindService,
    GameDecisionFlushProcessor,
    GameDecisionFlushScheduler,
  ],
  exports: [
    UserGameStateRepository,
    GameDecisionWriteBehindService,
  ],
})
export class UserGameStateModule {}
