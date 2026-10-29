import { Module } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"

import { AuthModule } from "@endpoints/auth/auth.module"
import { AccountModule } from "@endpoints/account/account.module"
import { UserItemEndpointModule } from "@endpoints/userItem/userItem.module"
import { CollectionEndpointModule } from "@endpoints/collection/collection.module"
import { ItemEndpointModule } from "@endpoints/item/item.module"
import { TagWeightModifiersModule } from "@endpoints/tagWeightModifiers/tagWeightModifiers.module"
import { RecommendationsModule } from "@endpoints/recommendations/recommendations.module"
import { SearchEndpointModule } from "@endpoints/search/search.module"

import { ItemModule } from "@entities/item/item.module"
import { CollectionModule } from "@entities/collection/collection.module"
import { ItemCollectionModule } from "@entities/itemCollection/itemCollection.module"
import { UserCollectionModule } from "@entities/userCollection/userCollection.module"
import { ItemBanModule } from "@entities/itemBan/itemBan.module"
import { ItemRelationModule } from "@entities/itemRelation/itemRelation.module"
import { RelationModule } from "@entities/relation/relation.module"
import { TagModule } from "@entities/tag/tag.module"
import { TagItemModule } from "@entities/tagItem/tagItem.module"
import { FactModule } from "@entities/fact/fact.module"
import { ItemStatsModule } from "@entities/itemStats/itemStats.module"
import { SiteStatsModule } from "@entities/siteStats/siteStats.module"
import { UserModule } from "@entities/user/user.module"
import { UserSettingsModule } from "@entities/userSettings/userSettings.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserSessionModule } from "@entities/userSession/userSession.module"
import { UserTasteProfileModule } from "@entities/userTasteProfile/userTasteProfile.module"

import { CacheModule } from "@infrastructure/cache/cache.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { AppExceptionFilter } from "@infrastructure/logger/decorators/AppExceptionFilter"
import { HealthModule } from "@infrastructure/health/health.module"
import { HttpModule } from "@infrastructure/http/http.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"
import { ThrottlingModule } from "@infrastructure/throttling/throttling.module"

import { AppController } from "./controllers/app.controller"

@Module({
  imports: [
    InfrastructureConfigModule,
    HttpModule,
    LoggerModule,
    DatabaseModule,
    CacheModule,
    ThrottlingModule,
    SchedulerModule,
    HealthModule,
    AuthModule,
    AccountModule,
    UserItemEndpointModule,
    CollectionEndpointModule,
    ItemEndpointModule,
    ItemModule,
    CollectionModule,
    ItemCollectionModule,
    UserCollectionModule,
    ItemBanModule,
    ItemRelationModule,
    RelationModule,
    TagModule,
    TagItemModule,
    FactModule,
    ItemStatsModule,
    SiteStatsModule,
    UserModule,
    UserSettingsModule,
    UserItemModule,
    UserSessionModule,
    UserTasteProfileModule,
    TagWeightModifiersModule,
    RecommendationsModule,
    SearchEndpointModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
class AppModule {}

export { AppModule }
