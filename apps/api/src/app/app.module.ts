import { Module } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"

import { CacheModule } from "@infrastructure/cache/cache.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { AppExceptionFilter } from "@infrastructure/filters/AppExceptionFilter"
import { HealthModule } from "@infrastructure/health/health.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"

import { GameModule } from "@entities/game/game.module"
import { PrefixModule } from "@entities/prefix/prefix.module"
import { TagModule } from "@entities/tag/tag.module"

import { AuthModule } from "../endpoints/auth/auth.module"
import { BootstrapModule } from "../endpoints/bootstrap/bootstrap.module"
import { GamesModule } from "../endpoints/games/games.module"
import { LibraryModule } from "../endpoints/library/library.module"
import { SwipeModule } from "../endpoints/swipe/swipe.module"
import { SyncModule } from "../endpoints/sync/sync.module"

@Module({
  imports: [
    InfrastructureConfigModule,
    LoggerModule,
    DatabaseModule,
    CacheModule,
    SchedulerModule,
    HealthModule,
    GameModule,
    TagModule,
    PrefixModule,
    AuthModule,
    GamesModule,
    LibraryModule,
    SwipeModule,
    SyncModule,
    BootstrapModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
class AppModule {}

export { AppModule }
