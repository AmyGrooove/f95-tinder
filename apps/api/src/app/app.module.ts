import { Module } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"

import { AuthModule } from "@endpoints/auth/auth.module"
import { AccountModule } from "@endpoints/account/account.module"
import { UserItemEndpointModule } from "@endpoints/userItem/userItem.module"
import { CollectionEndpointModule } from "@endpoints/collection/collection.module"
import { ItemEndpointModule } from "@endpoints/item/item.module"

import { ItemModule } from "@entities/item/item.module"
import { CollectionModule } from "@entities/collection/collection.module"
import { CollectionItemModule } from "@entities/collectionItem/collectionItem.module"
import { UserCollectionModule } from "@entities/userCollection/userCollection.module"
import { BannedItemModule } from "@entities/bannedItem/bannedItem.module"
import { RelationModule } from "@entities/relation/relation.module"
import { ItemRelationRoleModule } from "@entities/itemRelationRole/itemRelationRole.module"
import { TagModule } from "@entities/tag/tag.module"
import { ItemTagModule } from "@entities/itemTag/itemTag.module"
import { TagRelationModule } from "@entities/tagRelation/tagRelation.module"
import { FactModule } from "@entities/fact/fact.module"
import { SourceModule } from "@entities/source/source.module"
import { SourceItemModule } from "@entities/sourceItem/sourceItem.module"
import { ItemMetricModule } from "@entities/itemMetric/itemMetric.module"
import { UserModule } from "@entities/user/user.module"
import { UserSettingModule } from "@entities/userSetting/userSetting.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserSourceAccountModule } from "@entities/userSourceAccount/userSourceAccount.module"
import { SessionModule } from "@entities/session/session.module"
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
    CollectionItemModule,
    UserCollectionModule,
    BannedItemModule,
    RelationModule,
    ItemRelationRoleModule,
    TagModule,
    ItemTagModule,
    TagRelationModule,
    FactModule,
    SourceModule,
    SourceItemModule,
    ItemMetricModule,
    UserModule,
    UserSettingModule,
    UserItemModule,
    UserSourceAccountModule,
    SessionModule,
    UserTasteProfileModule,
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
