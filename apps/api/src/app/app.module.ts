import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { CatalogModule } from '../endpoints/catalog/catalog.module';
import { AuthModule } from '../endpoints/auth/auth.module';
import { ListsModule } from '../endpoints/lists/lists.module';
import { GameModule } from '../entities/game/game.module';
import { SwipeModule } from '../endpoints/swipe/swipe.module';
import { PrefixModule } from '../entities/prefix/prefix.module';
import { TagModule } from '../entities/tag/tag.module';
import { UserGameStateModule } from '../entities/userGameState/userGameState.module';
import { CacheModule } from '../infrastructure/cache/cache.module';
import { ConfigModule } from '../infrastructure/config/config.module';
import { DatabaseModule } from '../infrastructure/database/database.module';
import { HealthModule } from '../infrastructure/health/health.module';
import { JobsModule } from '../infrastructure/jobs/jobs.module';
import { F95Module } from '../integrations/f95/f95.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    CacheModule,
    JobsModule,
    HealthModule,
    GameModule,
    TagModule,
    PrefixModule,
    F95Module,
    CatalogModule,
    AuthModule,
    UserGameStateModule,
    SwipeModule,
    ListsModule,
  ],
})
export class AppModule {}
