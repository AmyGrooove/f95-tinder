# Сущности API

Краткое описание текущего содержимого `apps/api/src/entities` на 14 октября 2026 года: 17 самостоятельных сущностей. Список отсортирован по алфавиту.

Самостоятельные сущности хранятся в отдельных MongoDB-коллекциях с такими же именами, имеют `_id`, `createdAt`, `updatedAt`, свой модуль и репозиторий. Все 17 модулей подключены в `AppModule`.

В колонке «Связи» стрелка обозначает ссылку на другую сущность, а вложенные структуры указаны отдельно. `ItemId` содержит тип и ObjectId объекта каталога; это не отдельная коллекция.

| Сущность | Краткое описание | Связи |
| --- | --- | --- |
| [Feature](../apps/api/src/entities/feature/schemas/feature.schema.ts) | Справочник характеристик: уникальный ключ, группа, название и описание на RU/EN, тип значения (`string`, `number`, `boolean`, `date`) и единица измерения. | Используется в `ItemFeature.feature`; содержит `LanguageText`. |
| [ItemFeature](../apps/api/src/entities/itemFeature/schemas/itemFeature.schema.ts) | Значение характеристики конкретного объекта каталога. Хранит `item`, ссылку на `Feature` и значение; пара объект/характеристика уникальна. | `feature` → `Feature`; `item` — `ItemId`. |
| [ItemMetric](../apps/api/src/entities/itemMetric/schemas/itemMetric.schema.ts) | Одна запись агрегированной статистики на объект: число завершённых попыток, рекомендаций, оценок и добавлений в избранное, средняя оценка, распределение оценок и счётчики пользовательских статусов. | `item` — `ItemId`; содержит `RatingDistribution` и `UserItemStatusCounts`. |
| [ItemRelationRole](../apps/api/src/entities/itemRelationRole/schemas/itemRelationRole.schema.ts) | Справочник ролей объектов в связях: уникальный ключ, группа, название и описание на RU/EN. | Используется в `RelationSide.role`; содержит `LanguageText`. |
| [ItemTag](../apps/api/src/entities/itemTag/schemas/itemTag.schema.ts) | Связь объекта каталога с тегом и оценкой его релевантности от 0 до 1. Пара объект/тег уникальна. | `tag` → `Tag`; `item` — `ItemId`. |
| [Relation](../apps/api/src/entities/relation/schemas/relation.schema.ts) | Связь между двумя объектами каталога. Каждая сторона содержит объект, его роль и локализованное переопределение названия роли. | `first` и `second` — `RelationSide`: объект через `ItemId`, роль → `ItemRelationRole`. |
| [Session](../apps/api/src/entities/session/schemas/session.schema.ts) | Пользовательская сессия: уникальный хеш refresh-токена, user agent, срок действия и дата последнего обновления токена. Объявлен TTL-индекс с задержкой 10 минут после `expiresAt`. | `user` → `User`. |
| [Source](../apps/api/src/entities/source/schemas/source.schema.ts) | Внешний источник данных: уникальный ключ, название и описание на RU/EN, ссылки на логотип, сайт и API. | Используется в `SourceItem.source` и `UserSourceAccount.source`; содержит `LanguageText`. |
| [SourceItem](../apps/api/src/entities/sourceItem/schemas/sourceItem.schema.ts) | Запись объекта во внешнем источнике: источник, внешний идентификатор, URL и необязательная привязка к объекту каталога. Пара источник/внешний идентификатор уникальна. | `source` → `Source`; `item` — `ItemId` или `null`. |
| [Tag](../apps/api/src/entities/tag/schemas/tag.schema.ts) | Справочник тегов: уникальный ключ, группа, название и описание на RU/EN, альтернативные названия и необязательный вектор `embedding`. | Используется в `ItemTag`, `TagRelation` и `TasteTagPreference`; содержит `LanguageText` и `Embedding`. |
| [TagRelation](../apps/api/src/entities/tagRelation/schemas/tagRelation.schema.ts) | Связь двух тегов с типом отношения. Сейчас определён только `parent`: `first` — дочерний тег, `second` — родительский. | `first` и `second` → `Tag`. |
| [User](../apps/api/src/entities/user/schemas/user.schema.ts) | Учётная запись: уникальный username, отображаемое имя, email и дата его подтверждения, аватар, роль, хеши пароля и кода доступа, привязанные аккаунты провайдеров. | Используется в `Session`, `UserSetting`, `UserItem`, `UserSourceAccount`, `UserTasteProfile`, `UserRecommendationState`; содержит `LinkedAccount`. |
| [UserItem](../apps/api/src/entities/userItem/schemas/userItem.schema.ts) | Личная запись об объекте: статус, оценка 1–10, избранное, заметка и история попыток с прогрессом. Пара пользователь/объект уникальна. | `user` → `User`; `item` — `ItemId`; `attempts` — массив `ItemAttempt`. |
| [UserRecommendationState](../apps/api/src/entities/userRecommendationState/schemas/userRecommendationState.schema.ts) | Состояние рекомендаций для пары пользователь/объект: число показов и пропусков, даты первого и последнего показа, следующего допустимого показа, признак исключения и срок действия записи. | `user` → `User`; `item` — `ItemId`. |
| [UserSetting](../apps/api/src/entities/userSetting/schemas/userSetting.schema.ts) | Настройки пользователя: локаль `ru` или `en` (по умолчанию `ru`). На пользователя предусмотрена одна запись. | `user` → `User`. |
| [UserSourceAccount](../apps/api/src/entities/userSourceAccount/schemas/userSourceAccount.schema.ts) | Привязка пользователя к аккаунту внешнего источника через `externalId`. Один аккаунт на источник для пользователя; один внешний аккаунт может принадлежать только одному пользователю. | `user` → `User`; `source` → `Source`. |
| [UserTasteProfile](../apps/api/src/entities/userTasteProfile/schemas/userTasteProfile.schema.ts) | Один профиль вкусов на пользователя. По каждому типу объектов хранит положительный и отрицательный векторы, предпочтения по тегам и число взаимодействий. | `user` → `User`; `profiles` — массив `TasteItemTypeProfile`; через него связан с `Tag`. |

В каталоге сущностей сейчас нет отдельных `Item` и `Movie`; перечисление `EItemType` пока пустое. Описание отражает структуры хранения в исходниках, без проверки работающей базы данных или бизнес-операций.
