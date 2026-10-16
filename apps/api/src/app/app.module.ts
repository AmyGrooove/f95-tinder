import { Module } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"

import { MovieModule } from "@entities/movie/movie.module"
import { RelationModule } from "@entities/relation/relation.module"
import { ItemRelationRoleModule } from "@entities/itemRelationRole/itemRelationRole.module"
import { TagModule } from "@entities/tag/tag.module"
import { ItemTagModule } from "@entities/itemTag/itemTag.module"
import { TagRelationModule } from "@entities/tagRelation/tagRelation.module"
import { FeatureModule } from "@entities/feature/feature.module"
import { ItemFeatureModule } from "@entities/itemFeature/itemFeature.module"
import { SourceModule } from "@entities/source/source.module"
import { SourceItemModule } from "@entities/sourceItem/sourceItem.module"
import { ItemMetricModule } from "@entities/itemMetric/itemMetric.module"
import { UserModule } from "@entities/user/user.module"
import { UserSettingModule } from "@entities/userSetting/userSetting.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserSourceAccountModule } from "@entities/userSourceAccount/userSourceAccount.module"
import { SessionModule } from "@entities/session/session.module"
import { UserTasteProfileModule } from "@entities/userTasteProfile/userTasteProfile.module"
import { UserRecommendationStateModule } from "@entities/userRecommendationState/userRecommendationState.module"

import { CacheModule } from "@infrastructure/cache/cache.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { AppExceptionFilter } from "@infrastructure/logger/decorators/AppExceptionFilter"
import { HealthModule } from "@infrastructure/health/health.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"
import { ThrottlingModule } from "@infrastructure/throttling/throttling.module"

@Module({
  imports: [
    InfrastructureConfigModule,
    LoggerModule,
    DatabaseModule,
    CacheModule,
    ThrottlingModule,
    SchedulerModule,
    HealthModule,
    MovieModule,
    RelationModule,
    ItemRelationRoleModule,
    TagModule,
    ItemTagModule,
    TagRelationModule,
    FeatureModule,
    ItemFeatureModule,
    SourceModule,
    SourceItemModule,
    ItemMetricModule,
    UserModule,
    UserSettingModule,
    UserItemModule,
    UserSourceAccountModule,
    SessionModule,
    UserTasteProfileModule,
    UserRecommendationStateModule,
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
