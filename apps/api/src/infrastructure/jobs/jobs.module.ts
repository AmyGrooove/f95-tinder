import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

export const CATALOG_SYNC_QUEUE = 'catalog-sync';
export const CATALOG_SYNC_JOB = 'synchronize';
export const GAME_DECISION_FLUSH_QUEUE = 'game-decision-flush';
export const GAME_DECISION_FLUSH_JOB = 'flush';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: configService.redisOptions,
      }),
    }),
    BullModule.registerQueue({
      name: CATALOG_SYNC_QUEUE,
    }),
    BullModule.registerQueue({
      name: GAME_DECISION_FLUSH_QUEUE,
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
