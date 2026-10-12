# Bisky: план реализации movie-only MVP API

Current MVP decision: the OAuthAttempt MongoDB entity has been removed. Historical P1 mentions below do not require restoring it. OAuth state storage and retry behavior will be determined when implementing authentication; required OAuth checks remain.

Дата: 8 октября 2026 года. Статус: **P1 согласован и реализован на уровне persistence; runtime не проверен**. Ответ владельца «делай» после сверки и списка работ разрешил P1 и его зависимые persistence-контракты. P2–P6 не начаты; их поведение, внешние настройки и оставшиеся существенные решения требуют соответствующего этапа.

Цель: довести apps/api до полного локально принимаемого movie-only цикла по 11 DoD, сохранив identity, историю, запреты и воспроизводимость. Основание: [vision](projectVision.md), [дизайн](mvpDesign.md), [порядок чатов и актуальные решения](mvpChatPrompts.md). Более поздние явно согласованные решения имеют приоритет; технические предложения требуют принятия в указанной группе D. Принятие плана должно явно определить, какие D приняты; общий ответ о фильтрах/параметрах не утверждает их.

## 1. Границы, исходное состояние и архитектура

Изменение этого чата: только данный файл и согласованность mvpDesign.md. Vision и prompts сохраняются. Production, данные, индексы, credentials, Git staging/история не меняются. До работы уже были AM docs/mvpChatPrompts.md, A docs/mvpDesign.md, A docs/projectVision.md; их содержимое и staging сохранены.

Исходный снимок до P1, проверенный при подготовке плана:

| Область | Реализация сейчас | Разрыв для MVP |
| --- | --- | --- |
| entities | 17 корневых схем, 10 вложенных, entity-owned repositories/module; ItemId={type,id}, EItemType только movie | Нет Item/Movie, durable журналов, artifacts и request/exposure/snapshot сущностей |
| User/Session | temporary/permanent, только Google; username/email/provider uniqueness; refresh hash, expiry | Нет account API, постоянного кода, rotation/revoke, Яндекса/recovery; даты и живой owner check нужны отдельно |
| UserItem/state/taste/metrics | Пять статусов, attempts без ID, rating любое конечное число; shown dates обязательны; один набор preferences/embeddings | Нет commands/events/CAS, null shown до первого показа, нескольких центров, поколений проекций |
| Mongo | autoIndex:true; run(callback) через withTransaction; session передаётся явно | Нет explicit TransactionOptions; версия/topology/FCV/индексы реальной БД неизвестны |
| Search/storage/jobs | SearchService ensureIndex/upsert/search/delete/clear; S3 upload/download; BullMQ version/retry/cancel | Нет доменного sync; waitForTask не проверяет succeeded явно; upload допускает overwrite; очередь не durable журнал |
| HTTP/security | Только health controller, strict DTO pipe, URI versioning без default/prefix; JWT HS256 15m/30d; guards без DB check | SecurityModule не подключён, бизнес-endpoints отсутствуют, CORS dev разрешает любой origin |
| Mail/config | Resend, queue-only MailService → JobService → handler; Garage/S3 config, Meilisearch | Не заменять транспорт по старой памяти; recovery доставка ещё не наблюдалась |

Версии из apps/api/pnpm-lock.yaml: Nest common/core/platform-fastify 12.0.3, mongoose 9.10.1, Fastify 5.12.4, BullMQ 6.3.8, meilisearch SDK 0.62.0, bcryptjs 3.0.3, TypeScript 5.9.3. Прямые установленный package manifests в apps/api/node_modules недоступны; lockfile не доказывает установленный runtime. Серверные версии MongoDB/Meilisearch неизвестны. Compose в текущем дереве не найден. Ссылки AGENTS на entitiesSpec/EndpointReadiness не существуют; это не отсутствие production-схем.

Направление зависимостей Amy: app → endpoints → entities → infrastructure → shared. Schemas/repositories остаются в entities; application orchestration/controllers/CLI services — в endpoints; app только собирает entrypoints. Новые entity modules повторяют TagModule/TagRepository, без generic CRUD и barrel слоя. Portable engine принимает plain immutable входы; Movie adapter и загрузка repositories остаются вне engine. Служебный CLI собирает отдельный Nest context, без HTTP listener и без автоматического старта workers при dry-run.

**Поправка размещения:** текущий AccessTokenGuard в infrastructure может проверять JWT, но не импортировать User/Session repositories. P3 добавляет LiveSessionGuard в endpoints/auth поверх JWT guard; живые permissions тоже проверяются там. Публичные /me используют оба guard, запись повторно проверяет Session в своей transaction. Это предложение размещения D7, не утверждённое изменение security API.

## 2. Подтверждено и что нужно принять

Уже подтверждено, повторно не запрашивать:

- Item + отдельный Movie, постоянная identity произведения, ремейк отдельно; фильм может иметь один источник; два источника нужны набору.
- Ручной AI-пакет, исходные JSON/результат/происхождение; RU/EN обычно готовятся AI, публикация без одного перевода и fallback title locale → original → title другого активного языка → alias приняты.
- Ordinary account: generated login + постоянный перевыпускаемый code либо provider; тот же userId при link, sign_in в иной account без merge. Яндекс в РФ, Google вне РФ, email необязателен; без кода/доступного provider/verified email восстановления нет. Support bypass и резервный ключ не входят.
- Rolling Session четыре месяца с refresh; аккаунт/история не удаляются по неактивности. Прогресс фильма в минутах, новый просмотр с нуля.
- При split direct данные приоритетны, копии не перезаписывают их, alternatives/attempts сохраняются; ambiguous not_interested обоим до отдельных отмен; копии не новые независимые events/exposures.
- watch_now: допускает planned/on_hold; исключает in_progress, completed/dropped, сохранившиеся terminal attempts и rating. discover_later: исключает любой status/rating/favorite=true/attempts. Одна note сама по себе не known Item.
- Показ → 24 часа; skipped → 7 дней; мягкое влияние похожего skip с полураспадом 3 дня; до трёх центров; exploration 20%. Подтверждены стартовые значения, не остальные формулы или правила округления.

### Реестр существенных решений

Исторический реестр подготовки плана: варианты были **предложены**. Для P1 владелец принял D1 и только необходимые persistence-части D2/D6/D7/D8/D10/D11/D12/D13/D15, а также совместимый options-параметр транзакций из D5. Это не утверждает import/auth/ranking API и алгоритмы следующих этапов, параметры реального окружения, источники, retention или применение индексов к существующей БД. Они обозначают конкретные зависимости реализации; обсуждение можно вести группами. Источники и credentials не нужно выдумывать, чтобы написать код общего контракта, но соответствующая реальная приёмка остаётся открытой.

| ID | Решение для обсуждения / рекомендуемый вариант | Что блокирует |
| --- | --- | --- |
| D1 | Принять physical модель: shared Item/Movie ObjectId, Origin/locale/lineage, journals, поля/индексы задач P1; новые коллекции не под стратегии | Соответствующие P1 задачи, downstream contracts |
| D2 | Принять bisky.catalog-import/1, лимиты 100 records/units, 10 MiB JSON, 100 MiB package, depth 32; matching/reconciliation/override/reverse_merge из дизайна | P2.2–P2.6 |
| D3 | Выбрать два movie-источника, реальные разрешённые материалы, source ID namespaces/scales/counts, per-field/locale priorities и channels. Набор 24 canonical/38 records только ориентир | Реальные пакеты, source profiles, внешняя часть baseline, P6 provenance; synthetic не заменяет |
| D4 | Retention: владелец предпочитает удалять ненужное, но ни 90 дней, ни бессрочное хранение не приняты. Предлагается сохранять referenced provenance/decision before-after/event feature basis/request snapshots/code manifests; ненужное удалять только после выбора состава/срока и явного запуска | GC/retention, обещание exact replay и DoD 3/7/11; автоматический cleanup не реализовать до решения |
| D5 | Изолированная single-node replica set для функциональной локальной приёмки; определить Mongo server/FCV/имя set/БД/права и snapshot+majority+primary. Это не эксплуатационная отказоустойчивость | Все runtime записи P6; schema код можно статически проверять |
| D6 | Bootstrap catalog operator локальным CLI до обычной регистрации: явный target и machine/env access + server-issued catalog.manage, audit; actor из JSON не authority | Первое наполнение P2, не зависит от OAuth P3 |
| D7 | Принять auth API/DTO/cookies/CSRF, LiveSessionGuard размещение, long-code 24 bytes/bcrypt12, fresh proof, calendar UTC clamp, jti/rotation, retry 30s, encrypted credential receipt 5m | P1 auth schemas, P3.1–P3.3. Четыре месяца приняты, точная календарная арифметика/сроки receipts ещё нет |
| D8 | Google GIS verifier (предлагается google-auth-library), Яндекс code+PKCE/state+profile, приложения/конфигурация. Нужны actual client IDs/origins, Yandex redirect/scopes/secret для выбранного confidential flow, browser harness для приёмки | P3.4, реальные provider сценарии P6. Создание внешних проектов требует отдельного разрешения |
| D9 | Server region source/trusted proxies; РФ/unknown запрещают Google на begin/complete/link/reauth; unknown предлагает local/Яндекс. Для P6 — только явно локальный server-config region override, отключённый вне dev | P3.4/P6 region checks. Правовая/возрастная политика оператора и content policy не выбраны; IP не доказательство юридической совместимости |
| D10 | Recovery: собственный verified email challenge, fresh proof для add/change, expiry 30m; mail enqueue recovery из durable state, encrypted token dispatch artifact до отправки, single-use reset с receipt и revoke всех Session | P1 recovery и P3.5. Необязателен email пользователю, функция recovery входит в путь |
| D11 | Принять command/event union, attempts transitions, expectedRevision/no-op receipts, identity copies/direct clears, interactionFence и accepted exposure semantics; единый namespace eventId/exposureId | P4; точные transitions/DTO/fences ещё не продуктово согласованы |
| D12 | Принять featurePreparationVersion movie-features/1 уже в P4, frozen event basis, затем profile/ranking: y/h/s/c/t/d, bins/family budgets, clustering/thresholds/forced merge, blend/diversity/repetition, quotas для малого L, tie-break/seed | P4.1 feature basis, P5. Формулы §§3–7 дизайна остаются предложениями, стартовые параметры не их утверждение |
| D13 | Принять request/snapshot APIs, versions/code manifests, consistent cut, generations/CAS, unresolved item-local metrics при split | P1 recommendation schemas/P5/P6 replay; ItemMetric multi-generation меняет metric_item constraint |
| D14 | Согласовать filter DTO: импорт/поиск используют tagKeys и runtime min/max, рекомендации предлагают Tag IDs и runtime max. Предлагается один movie filter object tagKeys + year/runtime range + country/language + allowlisted Features, с разрешением IDs в adapter при необходимости | P2.7/P5.4. Это формат фильтров, не повторное обсуждение принятых библиотечных predicates |
| D15 | Fresh provider reauth: новая nonce/state подтверждает принадлежность попытке, но сама не доказывает новое активное подтверждение человеком. Уточнить достаточный freshness/proof contract и хранение server-issued reauth grant (storage to be determined during authentication implementation; no dedicated MongoDB entity) | Чувствительные link/regenerate/email операции P3; существующий intent sign_in/link не описывает этот путь полностью |

Противоречия сняты только на уровне статусов/согласованности: более поздний fallback и split priority уже приняты; ранние temporary и Google-only заменены ordinary-account сценарием. Непринятые D не становятся утверждёнными из-за появления точных путей ниже. До соответствующей задачи её D нужно зафиксировать ответом в mvpDesign.md; при изменении варианта обновить зависимые задачи, не начинать независящий код под другим контрактом.

## 3. Актуальная приёмка DoD 5 и синхронизация документов

Vision «Первая работающая основа», строка «Аккаунт», описание conversion, DoD 5, старые implementation-facts и «единственный способ входа» в открытых вопросах содержат temporary/Google-only. Это устаревшие требования относительно ответов в дизайне и общих правил prompts. Они **не обязательный сценарий приёмки**. Публичный каталог доступен без аккаунта; обычный account создаётся явным действием до owner recommendations/library, не при GET каталога.

Актуальный DoD 5:

1. Создать ordinary account локально, сохранить login/code; получить Session, библиотеку и events. Новый визит с refresh либо новый вход code возвращает тот же userId/данные; expiry Session не удаляет account.
2. Зарегистрировать/войти через доступный Яндекс либо Google; provider-only account может включить local code после принятого reauth. Link другого доступного способа к текущему account сохраняет userId, library, journal и snapshots.
3. Sign_in в уже существующий другой account отзывает заменяемую browser Session, переключает principal; оба набора данных сохраняются и не объединяются. Чужие sessions не отзываются этим переключением.
4. Regenerate/recovery делает старый код недействительным, отзывает прежние sessions; verified email reset одноразов, без auto-link по email. Без всех доступных доказательств восстановление отвергается, данные остаются.
5. Сервер запрещает Google для РФ/unknown, включая прямые complete/link/reauth API; действующая принадлежащая пользователю Session не запрещает чтение библиотеки по факту provider происхождения.

При отдельном разрешении синхронизировать docs/projectVision.md в перечисленных местах, включая актуальный DoD 5; не менять historical факты о нынешней schema до реализации. DoD 11 уточнить принятую copy-to-both exception вместо назначения одному случайному recipient. docs/mvpChatPrompts.md уже содержит актуальные P3/P4/P6 и стартовые решения; после принятия D достаточно сверить ссылки/статусы, не менять scope автоматически. В этом чате vision/prompts не редактируются.

## 4. Порядок, разрешённые проверки и прогресс

Порядок реальных зависимостей:

P1.1–P1.4 → P1.6 snapshots/ref → P1.5 events/exposures → P2 CLI operator/bootstrap → validate/stage → dictionary/source bootstrap → matching/publish → identity/corrections → search/catalog → P3 auth → P4 frozen feature basis → library journal/identity → exposure/feedback receiver → P5.2 source cut/metrics/state → P5.1 taste → P5.3 strategies → P5.4 request producer → P5.5 replay → P5.6 recovery → P6 полный цикл.

P2 bootstrap не ждёт регистрации P3. P4 receiver может существовать до producer P5: без completed request принимает только отказ, fake request/exposure создавать нельзя. Подготовка feature basis перенесена в P4, иначе первые оценки невоспроизводимы. P2 merge/split пишет durable mapping; пользовательская проекция этого mapping появляется в P4/P5, поэтому полный DoD 11 закрывается лишь P6.

При подготовке плана все задачи были **не начато**; актуальные статусы P1 и отчёт приведены ниже. Вести четыре независимые колонки: реализация (не начато/реализовано), статически проверено (нет/команда+результат), runtime проверено (нет/сценарий+доказательство). Документированная схема не «реализовано», build не runtime. Частичный статус отмечать по подзадаче; не повышать весь этап из-за соседнего результата.

Разрешённые проверки:

- S0: статический self-review файлов/контрактов, точность ссылок и git diff --check; без запуска Nest/подключений.
- S1: из apps/api после проверки scripts выполнить pnpm run type-check; pnpm exec eslint <точный список изменённых production ts/mjs>; pnpm exec prettier --check <изменённые файлы>. Форматировать только конкретные файлы. Нет широких lint:fix/format. Сначала проверить отсутствие запрещённых файлов в inputs/config includes; появление tests требует исключения, не разрешения на чтение.
- S2: pnpm run build при изменении entrypoint/wiring/зависимости. CLI P2.1 включается в тот же pnpm run build, runtime command pnpm run catalog <операция> допустима только P6. Не запускать built app до P6. Команда build сейчас nest build/Rspack, не tests.
- R: описанные ниже локальные HTTP/CLI/manual provider сценарии выполняются **только P6 после фактического разрешения в чате**, на подтверждённых isolated targets. Не тестовые файлы/runner. P1–P5 завершаются static результатом и списком будущих R.

У каждой задачи ниже S0/S1 обязательны для соответствующих файлов, S2 указан дополнительно; R — будущий критерий поведения. При отсутствии tooling указать ограничение, не устанавливать/обновлять зависимости ради проверки документа.

### Границы данных и запуска

Ни схема, ни P1 prompt не разрешают миграцию/удаление/индексы существующей базы. autoIndex:true способен писать при старте: до любого application context P6 выбрать отдельную БД/URI, replica set и credentials, APP_NAME для bucket/cache/queue/JWT isolation, Redis DB/prefix и отдельные Meilisearch indexes/master-key scope. Один новый index при старом bucket/queue недостаточен. Worker/CLI целится в те же изолированные namespaces.

Для старых данных отдельный rollout: read-only inventory/backup по отдельному разрешению; duplicates/normalized username/email/provider IDs; source_external_item/item_source и metric_item constraints; преобразование locale/User.type/attempt IDs/nullable dates; проверка rollback/restore и сохранение Item/user IDs. Не syncIndexes/dropDatabase/drop collections на рабочей БД. Запись новых схем в существующие документы не планируется автоматически. Старые события без feature basis нельзя объявить exact replay; отдельный reconstruct policy с новой version и cutoff. В этом плане миграционные scripts для существующей БД не создаются.

## 5. Задачи P1 — минимальная persistence-модель

Номера задач сохраняют области ответственности; исполняемый порядок P1.1 → P1.2 → P1.3 → P1.4 → P1.6 → P1.5. В P5 source cut/metrics P5.2 предшествует taste P5.1.

Общее P1: только schema/repository/module/type constraints, без business endpoints/импорта/auth/ranking. Новые root schemas получают timestamps/strict/versionKey:false, обязательные refs проверяются сервисом будущей операции, nullable/defaults как дизайн. Child schemas без собственных _id/timestamps. Все participating repository operations принимают session; композиция существующих Mongo*Repository, не новый универсальный фасад. AppModule подключает entity modules; ниже это общий существующий файл всех P1 задач: apps/api/src/app/app.module.ts.

### P1.1. Общие тексты, происхождение и Item/Movie

Статус: **реализовано**; статически проверено: S0/S1, общий wiring также S2 (отчёт P1 в §9); runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/entities/item/schemas/item.schema.ts`
- Создать новый: `apps/api/src/entities/item/services/item.repository.ts`
- Создать новый: `apps/api/src/entities/item/item.module.ts`
- Создать новый: `apps/api/src/entities/movie/schemas/movie.schema.ts`
- Создать новый: `apps/api/src/entities/movie/services/movie.repository.ts`
- Создать новый: `apps/api/src/entities/movie/movie.module.ts`
- Создать новый: `apps/api/src/entities/shared/schemas/localizedTitle.schema.ts`
- Создать новый: `apps/api/src/entities/shared/schemas/origin.schema.ts`
- Создать новый: `apps/api/src/entities/shared/schemas/storageRef.schema.ts`
- Изменить существующий: `apps/api/src/entities/shared/schemas/languageText.schema.ts`
- Изменить существующий: `apps/api/src/entities/shared/schemas/itemId.schema.ts`
- Изменить существующий: `apps/api/src/infrastructure/database/services/mongoTransaction.service.ts`

**Ответственность:** Entity persistence; новый Item/Movie, locale и Origin; ItemId сохраняет type/id.

**Вход:** D1, принятый fallback; вложенные Origin={kind,decision,evidence,processingRun,derived inputs/rule}, StorageRef={backend,bucket,key}.

**Выход:** Item/Movie 1:1 shared ObjectId; LocalizedTitle={key,locale nullable,role,text,origin}; LanguageText={key,locale,text,origin}; Movie definitions для P2.

**Поля, индексы, инварианты:** Item: type,availability,isExcluded,redirectTo,revision,currentDecision,interactionFence. Movie: titles/descriptions,year/runtime/language/countries/poster/sourceMetrics/fieldOrigins/revision. Индексы item_eligible(type,availability,isExcluded,redirectTo,_id), item_redirect(redirectTo,_id), встроенные _id. Не принимать cycles/type mismatch/publication только по ref.; минимальное совместимое расширение run(callback, options?) с TransactionOptions snapshot/majority/primary для новых операций, без изменения existing callers; тип проверить по installed ClientSession.withTransaction.

**Зависимости:** D1; interactionFence D11; остальные P1 зависят от этого контракта; D5 concerns.

**Критерий готовности:** Схемы задают отсутствие неизвестных полей без fake values; available publication gate будет сервисом P2; сериализация id не меняет identity. Никакой записи в БД..

**Разрешённые проверки:** S0/S1; R: создание Item+Movie одной transaction, отказ malformed publication — P6.1.

- [x] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [x] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P1.2. Словари, typed bindings и отношения

Статус: **реализовано**; статически проверено: S0/S1, общий wiring также S2 (отчёт P1 в §9); runtime проверено: нет.

**Файлы**:

- Изменить существующий: `apps/api/src/entities/tag/schemas/tag.schema.ts`
- Изменить существующий: `apps/api/src/entities/feature/schemas/feature.schema.ts`
- Изменить существующий: `apps/api/src/entities/itemTag/schemas/itemTag.schema.ts`
- Изменить существующий: `apps/api/src/entities/itemFeature/schemas/itemFeature.schema.ts`
- Изменить существующий: `apps/api/src/entities/itemRelationRole/schemas/itemRelationRole.schema.ts`
- Изменить существующий: `apps/api/src/entities/relation/schemas/relation.schema.ts`
- Изменить существующий: `apps/api/src/entities/relation/schemas/relationSide.schema.ts`
- Изменить существующий: `apps/api/src/entities/tagRelation/schemas/tagRelation.schema.ts`

**Ответственность:** Существующие entity schemas/create types; business validation позже в P2.

**Вход:** Locale/Origin P1.1; Feature valueType/unit/definitionRevision.

**Выход:** Стабильные key, scope/applicableTypes/tasteTransfer/transferTypes, provenance; typed ItemFeature.

**Поля, индексы, инварианты:** Tag/Feature revision+definitionOrigin; relevanceScore [0,1]; ItemFeature featureRevision+origin/revision; Relation/TagRelation origin. Сохранить feature_key/tag_key/relation_role_key/item_tag/tag_item/item_feature/feature_item/tag_relation_from_type_to/tag_relation_to_type_from и Relation lookup indexes. Направленный/symmetric tupleKey unique relation_tuple предлагается D2; сервис канонизирует его, не меняя remake identity..

**Зависимости:** P1.1, D1/D2.

**Критерий готовности:** Все прежние потребители LanguageText (Source P1.3 также) переводятся согласованно; Feature соответствие определению требует P2, не выдается за schema-only гарантию. Embedding остаётся optional..

**Разрешённые проверки:** S0/S1; R: invalid type/unit, alias dictionary reuse — P6.1.

- [x] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [x] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P1.3. Источники, artifacts, runs, решения и search state

Статус: **реализовано**; статически проверено: S0/S1, общий wiring также S2 (отчёт P1 в §9); runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/entities/sourceArtifact/schemas/sourceArtifact.schema.ts`
- Создать новый: `apps/api/src/entities/sourceArtifact/services/sourceArtifact.repository.ts`
- Создать новый: `apps/api/src/entities/sourceArtifact/sourceArtifact.module.ts`
- Создать новый: `apps/api/src/entities/processingRun/schemas/processingRun.schema.ts`
- Создать новый: `apps/api/src/entities/processingRun/services/processingRun.repository.ts`
- Создать новый: `apps/api/src/entities/processingRun/processingRun.module.ts`
- Создать новый: `apps/api/src/entities/catalogDecision/schemas/catalogDecision.schema.ts`
- Создать новый: `apps/api/src/entities/catalogDecision/services/catalogDecision.repository.ts`
- Создать новый: `apps/api/src/entities/catalogDecision/catalogDecision.module.ts`
- Создать новый: `apps/api/src/entities/searchIndexState/schemas/searchIndexState.schema.ts`
- Создать новый: `apps/api/src/entities/searchIndexState/services/searchIndexState.repository.ts`
- Создать новый: `apps/api/src/entities/searchIndexState/searchIndexState.module.ts`
- Изменить существующий: `apps/api/src/entities/source/schemas/source.schema.ts`
- Изменить существующий: `apps/api/src/entities/sourceItem/schemas/sourceItem.schema.ts`

**Ответственность:** Durable ingestion/identity foundation и служебные checkpoints.

**Вход:** P1.1/P1.2, D1/D2; неизменяемые bytes ссылками.

**Выход:** SourceItem до matching, run/package receipt, accepted decision и catalogSequence; SearchIndexState active pointer/counter/lease.

**Поля, индексы, инварианты:** SourceItem namespace=movie,item nullable,bindingDecision,suppressionDecision,revision. SourceArtifact kind/sourceItem/run/ref/hash/sizeBytes/schemaVersion/mediaType/capturedAt. Run packageId/digest/versions/inputs/context/AI/output/unitResults/status/actor. Decision operationKey/contentDigest/kind/actor/reason/subjects/expectedRevisions/reversesDecision/changesArtifact/appliedAt/catalogSequence/assignedIds. State key=movie,counter,activeIndex,generation,documentVersion,checkpoint,rebuild/lease. Unique source_external_identity(source,namespace,externalId), nonunique item_source_lookup(item.type,item.id,source); старые source_external_item/item_source на isolated DB заменены declarations, не миграцией. Unique artifact_storage(ref.backend,ref.bucket,ref.key), run_package(packageId), decision_operation(operationKey), decision_sequence(catalogSequence), search_state_key(key); decision_subjects(subjects.type,subjects.id,catalogSequence), run_status(status,createdAt,_id), artifact_source(sourceItem,capturedAt,_id)..

**Зависимости:** P1.1/P1.2; D1/D2/D6.

**Критерий готовности:** Metadata отделены от bytes; catalogSequence выделяется в publication transaction; suppression не сбрасывается повтором. Source ключи стабильны. S3 immutable/privacy — ещё не проверены..

**Разрешённые проверки:** S0/S1; R: unique external identity и resume run — P6.1.

- [x] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [x] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P1.4. Обычный User/Session и auth evidence

Статус: **реализовано**; статически проверено: S0/S1, общий wiring также S2 (отчёт P1 в §9); runtime проверено: нет.

**Файлы**:

- Изменить существующий: `apps/api/src/entities/user/schemas/user.schema.ts`
- Изменить существующий: `apps/api/src/entities/user/schemas/ELinkedAccountProvider.ts`
- Изменить существующий: `apps/api/src/entities/user/schemas/linkedAccount.schema.ts`
- Изменить существующий: `apps/api/src/entities/user/schemas/EUserType.ts`
- Изменить существующий: `apps/api/src/entities/session/schemas/session.schema.ts`
- Создать новый: `apps/api/src/entities/credentialOperationReceipt/schemas/credentialOperationReceipt.schema.ts`
- Создать новый: `apps/api/src/entities/credentialOperationReceipt/services/credentialOperationReceipt.repository.ts`
- Создать новый: `apps/api/src/entities/credentialOperationReceipt/credentialOperationReceipt.module.ts`
- Создать новый: `apps/api/src/entities/recoveryChallenge/schemas/recoveryChallenge.schema.ts`
- Создать новый: `apps/api/src/entities/recoveryChallenge/services/recoveryChallenge.repository.ts`
- Создать новый: `apps/api/src/entities/recoveryChallenge/recoveryChallenge.module.ts`
- Создать новый: `apps/api/src/entities/accountAccessEvent/schemas/accountAccessEvent.schema.ts`
- Создать новый: `apps/api/src/entities/accountAccessEvent/services/accountAccessEvent.repository.ts`
- Создать новый: `apps/api/src/entities/accountAccessEvent/accountAccessEvent.module.ts`

**Ответственность:** Persistence доступа; удалить EUserType только если после schema change нет production references, без преобразования БД.

**Вход:** D7/D8/D10/D15; нет temporary conversion.

**Выход:** Обычный User и rolling Session, provider attempts, secret receipts/challenges/audit для P3 и operator fields P2.

**Поля, индексы, инварианты:** User revision/actionSequence,accessCodeHash select:false nullable,credentialVersion,changedAt,catalogPermissions[]; existing email/verifiedAt и username/linkedAccounts uniqueness; YANDEX enum. Type и temporaryCodeHash не используются новым путём; их удаление из schema/create types — D1/D7, не перенос старых credentials. Session rotation/jti/issuedAt/revision/revoke/reason/receipt. Temporary OAuth state: browser/owner/session binding, state/nonce/PKCE and expiry; choose storage in P3 without a dedicated MongoDB entity. Credential receipt operationId/binding/digest/result IDs/retryUntil/encryptedSecret/encryptionKeyVersion. Challenge purpose/user/email/tokenHash/credentialVersion/expiry/consumedAt/deliveryState/encryptedDeliveryArtifactRef. AccountAccessEvent operationId/actor/target/kind/time/proofRef. Unique credential_operation(operationId), recovery_token(tokenHash), access_operation(operationId); recovery_delivery(deliveryState,createdAt,_id). Сохранить user_username/user_email partial/user_linked_account partial/session_refresh_token_hash/session_user_expiry. No automatic TTL; ciphertext cleanup отдельный scoped процесс D4..

**Зависимости:** P1.1, D1/D6/D7/D8/D10/D15.

**Критерий готовности:** Raw codes/tokens select:false недостаточно: entity toJSON и будущие DTO allowlist без секретов, explicit lean/aggregate projections. До P3 обычный account не создаётся API..

**Разрешённые проверки:** S0/S1; R: identity collisions/receipt replay/expiry — P6.2.

- [x] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [x] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P1.6. Снимки, запросы и минимальные проекции

Статус: **реализовано**; статически проверено: S0/S1, общий wiring также S2 (отчёт P1 в §9); runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/entities/recommendationSnapshot/schemas/recommendationSnapshot.schema.ts`
- Создать новый: `apps/api/src/entities/recommendationSnapshot/services/recommendationSnapshot.repository.ts`
- Создать новый: `apps/api/src/entities/recommendationSnapshot/recommendationSnapshot.module.ts`
- Создать новый: `apps/api/src/entities/recommendationRequest/schemas/recommendationRequest.schema.ts`
- Создать новый: `apps/api/src/entities/recommendationRequest/services/recommendationRequest.repository.ts`
- Создать новый: `apps/api/src/entities/recommendationRequest/recommendationRequest.module.ts`
- Создать новый: `apps/api/src/entities/recommendationProjectionState/schemas/recommendationProjectionState.schema.ts`
- Создать новый: `apps/api/src/entities/recommendationProjectionState/services/recommendationProjectionState.repository.ts`
- Создать новый: `apps/api/src/entities/recommendationProjectionState/recommendationProjectionState.module.ts`
- Изменить существующий: `apps/api/src/entities/userTasteProfile/schemas/userTasteProfile.schema.ts`
- Изменить существующий: `apps/api/src/entities/userTasteProfile/schemas/tasteItemTypeProfile.schema.ts`
- Изменить существующий: `apps/api/src/entities/userTasteProfile/schemas/tasteTagPreference.schema.ts`
- Изменить существующий: `apps/api/src/entities/itemMetric/schemas/itemMetric.schema.ts`

**Ответственность:** Persistence engine/rebuild без расчётной логики; shared snapshot ref доступен до P1.5.

**Вход:** D12/D13, storageRef P1.1; proposed version bundle дизайна.

**Выход:** Request receipts, immutable catalog/profile/context metadata/chunks, projection generations/manifests.

**Поля, индексы, инварианты:** Snapshot kind/version/hash/size/chunks/storageRef/manifest/owner-service visibility/basis. Request user/requestId/intentDigest/status/time/seed/versions/parameters/snapshots/calculatedRanking/liveGateBasis/returnedResults/diagnostics/error/compareGroupId. Profile centres+s/c/M/u/v/t/w,negative b,revision/versions/checkpoints/identity/inputDigest/evidence refs; no unbounded events. Metric generation/item,integer histogram/counts/average,calculationVersion/inputDigest/cutoff/unresolved refs. Projection state key/generation/status/inputDigest/source-cut ref/checkpoints/lease/activeMetricsGeneration; one key per rebuild plus active pointer, не стратегические коллекции. Unique request_owner(user,requestId), request_history(user,createdAt,_id) nonunique, projection_state_key(key), metric_generation_item(generation,item.type,item.id) вместо metric_item; taste_profile_user остаётся unique. Sparse preference chunks bounded в snapshot..

**Зависимости:** P1.1/P1.3/P1.4; D12/D13; shared ref schemas прежде P1.5, wiring после обеих.

**Критерий готовности:** Общие request/result types для baseline/personal, одна metadata модель snapshots. Достаточно declared schema для последующего replay; ни ranking, ни профиль не посчитаны..

**Разрешённые проверки:** S0/S1/S2 для P1 wiring; R: metadata/chunk refs и generation uniqueness — P6.3.

- [x] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [x] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P1.5. Библиотечное состояние, события и экспозиции

Статус: **реализовано**; статически проверено: S0/S1, общий wiring также S2 (отчёт P1 в §9); runtime проверено: нет.

**Файлы**:

- Изменить существующий: `apps/api/src/entities/userItem/schemas/userItem.schema.ts`
- Изменить существующий: `apps/api/src/entities/userItem/schemas/itemAttempt.schema.ts`
- Изменить существующий: `apps/api/src/entities/userItem/schemas/EProgressUnit.ts`
- Изменить существующий: `apps/api/src/entities/userRecommendationState/schemas/userRecommendationState.schema.ts`
- Создать новый: `apps/api/src/entities/userAction/schemas/userAction.schema.ts`
- Создать новый: `apps/api/src/entities/userAction/services/userAction.repository.ts`
- Создать новый: `apps/api/src/entities/userAction/userAction.module.ts`
- Создать новый: `apps/api/src/entities/recommendationExposure/schemas/recommendationExposure.schema.ts`
- Создать новый: `apps/api/src/entities/recommendationExposure/services/recommendationExposure.repository.ts`
- Создать новый: `apps/api/src/entities/recommendationExposure/recommendationExposure.module.ts`

**Ответственность:** Schemas/receipts hard state; command behavior принадлежит P4.

**Вход:** D11/D12; User P1.4 и immutable feature ref из P1.6.

**Выход:** UserAction typed envelope, UserItem projection с lineage, Exposure с одним shown action.

**Поля, индексы, инварианты:** UserItem rating integer1..10 nullable, revision/checkpoint/identityBasis/direct+copied lineage/conflicts; attemptId,created/updatedSequence,minute,progress nullable safe integer>=0, tombstone IDs без reuse. State nullable first/lastShownAt,lastSkippedAt,nextEligibleAt,isExcluded,policyVersion/revision/checkpoint/basis; expiresAt=null не TTL. Action eventId/version/user/sequence/time/session/kind/payload requested/resolved/context/exposure/basis/digest/revisions/changed/receipt/before-after/featureBasisRef+version+deadline. Exposure exposureId/request/resultKey/issued-resolved identity/actionEventId/sequence/digest/display/frozen basis/time/policy deadline. Unique action_event(user,eventId), action_sequence(user,sequence), exposure_event(user,exposureId); action_item(user,requestedItem.id,sequence), action_feedback(exposure,recordedAt,_id), exposure_recent(user,recordedAt,_id), exposure_result(user,request,resultKey) nonunique. Сохранить user_item/item_user/recommendation_user_item..

**Зависимости:** P1.1/P1.4/P1.6 shared ref definitions; D11/D12; взаимные refs не DI cycle.

**Критерий готовности:** Strict envelope union включает shown, все clear/set/attempt commands, skipped/not_interested. Один accepted exposure = один action/sequence; semantic переходы ещё P4..

**Разрешённые проверки:** S0/S1; R: atomic state+event, null dates/no-op — P6.2.

- [x] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [x] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

## P2 — служебный импорт, исправления, обратимый merge/split, каталог и поиск

### P2.1. Служебный CLI и первое удостоверение оператора

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Изменить существующий: `apps/api/src/main.ts`
- Создать новый: `apps/api/src/app/catalogCli.ts`
- Создать новый: `apps/api/src/app/catalogCli.module.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/catalogManagement.module.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogOperator.service.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogCommand.service.ts`
- Изменить существующий: `apps/api/src/infrastructure/database/database.module.ts`
- Изменить существующий: `apps/api/package.json`

**Ответственность:** CLI entrypoint, не public HTTP; отдельный narrow context, без AppModule/HealthModule/HTTP.

**Вход:** Явный env target + operator ID либо bootstrap intent; machine access + env credentials; не доверять actor в manifest.

**Выход:** Команды operator-bootstrap/validate/dry-run/stage/apply/inspect/decide/correct/exclude/merge/split/rebuild-search; audit actor/method/reason.

**Поля, индексы, инварианты:** Bootstrap создаёт служебный обычный User с required login/displayName/locale и catalogPermissions=[catalog.manage], без OAuth и без выдачи доступов всем зарегистрированным. Idempotency operationId в AccountAccessEvent. Seed Source/dictionary — отдельная явная команда после bootstrap. Назначить actor требуется один раз; повтор не создаёт вторую роль. CatalogCliModule.forMode(mode) собирает validate/dry-run context с validators/readers отдельно от apply/job providers; DatabaseModule read-only context получает autoIndex:false/autoCreate:false через scoped bootstrap options, без второго клиента и без изменения HTTP defaults. Dry-run не запускает workers/S3-search init и не создаёт индексы. Config validation отделить от подключения..

**Зависимости:** P1.3/P1.4, D6; P3 не требуется.

**Критерий готовности:** Переиспользовать текущий build → dist/main.js. Main до bootstrap выбирает по явному argv command catalog функцию runCatalogCli(args), иначе прежний HTTP bootstrap. catalogCli.ts экспортирует функцию и не исполняется при import. Package script catalog = node dist/main.js catalog; отдельный compiler/config/output не нужен. CLI context не создаёт HTTP app и проверяет target прежде Nest connections. Runtime запуска не делать до P6. Обычный caller/operator без catalog.manage отвергается..

**Разрешённые проверки:** S0/S1/S2 включая dispatch в существующем bundle; R: isolated operator-bootstrap и denied actor — P6.1.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P2.2. Проверка импортного пакета и source bootstrap

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/catalogManagement/dto/catalogImportManifest.dto.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/static/CATALOG_IMPORT_SCHEMA.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogPackageValidation.service.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogBootstrap.service.ts`
- Дополнить новый из P2.1: `apps/api/src/endpoints/catalogManagement/services/catalogCommand.service.ts`
- Создать новый: `apps/api/demo/catalog-import-v1/manifest.json`
- Создать новый: `apps/api/demo/catalog-import-v1/raw/source-a.json`
- Создать новый: `apps/api/demo/catalog-import-v1/raw/source-b.json`
- Создать новый: `apps/api/demo/catalog-import-v1/normalized/source-a.json`
- Создать новый: `apps/api/demo/catalog-import-v1/normalized/source-b.json`
- Создать новый: `apps/api/demo/catalog-import-v1/ai/result.json`
- Создать новый: `apps/api/demo/catalog-import-v1/context/catalog.json`
- Создать новый: `apps/api/demo/catalog-import-v1/context/source-profiles.json`
- Создать новый: `apps/api/demo/catalog-import-v1/decisions/proposals.json`

**Ответственность:** Manifest/semantic validation, dry-run и демонстрационные данные, не тестовые файлы.

**Вход:** bisky.catalog-import/1 с file digests/record+unit keys/dependsOn/expectedRevisions/coverage; operator auth.

**Выход:** ValidatedPackage/ValidationReport {counts,unitOrder,field/provenanceDiff,conflicts,blocks}; dry-run без writes; bootstrap Sources и принятых dictionary definitions.

**Поля, индексы, инварианты:** Лимиты D2; version/unknown fields/hash/size/pointers/path bounds/symlink/JSON duplicate keys/type/unit checks. Source profiles назначаются служебно; synthetic demo-a/demo-b IMPORT, не выдаются за реальные sources. Proposal dependencies dictionary → movies → relations, pending records вне publish. Files могут содержать массивы нескольких records с JSON pointers; manifest все refs перечисляет..

**Зависимости:** P2.1/P1.1–P1.3,D2; D3 для реальных profiles.

**Критерий готовности:** Демонстрационный пакет полностью исполнимый, не пример с placeholders/hash <64hex>; включает shared ID/conflict/ambiguous/remake/missing translation/две группы интереса. dry-run не создаёт S3/run/jobs; bootstrap — явная write операция P6. При реальных источниках demo не подменяет материалы..

**Разрешённые проверки:** S0/S1; JSON structural+hash check без подключения; R: malformed/version/path conflicts — P6.1.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P2.3. Stage artifacts и recoverable run

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogArtifact.service.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogImport.service.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/handlers/catalogImportJob.handler.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/static/CATALOG_IMPORT_JOB.ts`
- Дополнить новый из P2.1: `apps/api/src/endpoints/catalogManagement/catalogManagement.module.ts`

**Ответственность:** Stage/immutable artifact IO/run resume через StorageService и JobsModule.

**Вход:** ValidatedPackage/operator/run key; source records могут item=null.

**Выход:** ProcessingRun receipt/статус/unit results refs; raw/normalized/AI/context bytes проверены; job payload {runId},version=1.

**Поля, индексы, инварианты:** Назначить run/artifact IDs/keys до upload; raw/AI/private context ключи только server generated. Download/hash size verification до publication. packageId+digest conflict, metadata resume; orphan objects только отчёт, без авто-delete. Run durable, job retention 7d/1000 completed,14d/2000 failed не определяет его хранение..

**Зависимости:** P2.2/P1.3,D2/D4; isolated private bucket в P6.

**Критерий готовности:** Stage без publish; после обрыва upload resume использует прежние refs; mixed digest не перезаписывает run; cancelled сохраняет committed units. No raw/public URL в DTO..

**Разрешённые проверки:** S0/S1/S2 handler wiring; R: upload/DB/queue interruption — P6.1.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P2.4. Matching, reconciliation и атомарная публикация

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogMatching.service.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogReconciliation.service.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogPublication.service.ts`
- Дополнить новый из P2.3: `apps/api/src/endpoints/catalogManagement/services/catalogImport.service.ts`

**Ответственность:** Одно canonical произведение, сохранённые claims и durable decision.

**Вход:** Staged run/unit, source profile/IDs/AI proposal, dictionary definitions+expected revisions.

**Выход:** applied/noop/pending result с assigned Item IDs и CatalogDecision(operationKey,digest,catalogSequence).

**Поля, индексы, инварианты:** Exact own external ID → trusted cross refs → title candidates top10; conflicting IDs pending, remake/create reviewed. Manual override > accepted source priorities > AI fill > absent. delta/full declared coverage, explicit null/[] не удаляет другое/manual. Movie+Item revision+bindings+decision+sequence в одной transaction, prepared changes artifact с hash до неё. Dictionary/type/unit validation в service; runtime derived Feature обновляется с Movie..

**Зависимости:** P2.3/P1.1–P1.3,D2/D3; synthetic profiles позволяют разработку без выбора реальных источников.

**Критерий готовности:** Retry operationKey/digest до revisions; same package/new package не дублирует identity; no-op не повышает revision. Source cross-ID unique защищает concurrent reservation. Не использовать Meilisearch отсутствие hit как отсутствие фильма..

**Разрешённые проверки:** S0/S1; R: first fill, repeat,new package, stale/collision/partial — P6.1.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P2.5. Исправления, исключения и обратимый merge/split

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/catalogManagement/dto/catalogDecision.dto.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogCorrection.service.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogIdentity.service.ts`
- Дополнить новый из P2.1: `apps/api/src/endpoints/catalogManagement/services/catalogCommand.service.ts`

**Ответственность:** Служебные reviewed decisions с immutable mapping и before-after.

**Вход:** operator+reason+operationId/digest+expectedRevisions; адрес поля/elementKey/binding/source/pointer; explicit split assignment.

**Выход:** Correction/override/block/release; merge A+B→A с B сохранённым; reverse_merge на исходные IDs; mapping для P4/P5.

**Поля, индексы, инварианты:** Перед/после, redirects/source bindings/alternatives/overrides/late writes/relations/mapping decision artifact. cycles/self/different types reject; exclusion сохраняется до release. Split new postmerge records assigned A/B/pending, ambiguous user lineage копируется обоим без новых событий; direct priority потребляет P4, not_interested обоим. catalogSequence/currentDecision/fence doc writes обеспечивают сериализацию..

**Зависимости:** P2.4,D2/D11/D13; P4/P5 для пользовательского результата.

**Критерий готовности:** Identity/source/catalog reverse реализован независимо от отсутствующих user projections; pending не назначается произвольно. Late correction не теряется; original event bytes не переписаны. Full DoD11 ещё не закрыт до P4/P5/P6..

**Разрешённые проверки:** S0/S1; R: erroneous/nested merge+late data+split и repeated import after block — P6.1/3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P2.6. Доставка решений в поиск и поколение индекса

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Изменить существующий: `apps/api/src/infrastructure/search/services/search.service.ts`
- Создать новый: `apps/api/src/infrastructure/search/types/ISearchTaskResult.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/movieSearchDocument.service.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogSearchSync.service.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/handlers/catalogSearchSyncJob.handler.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/static/CATALOG_SEARCH_SYNC_JOB.ts`
- Создать новый: `apps/api/src/endpoints/catalogManagement/services/catalogRecovery.service.ts`
- Дополнить новый из P2.1: `apps/api/src/endpoints/catalogManagement/catalogManagement.module.ts`

**Ответственность:** Search task acknowledgement + durable sync/rebuild, не duplicate Meilisearch client.

**Вход:** CatalogDecision.catalogSequence и текущий Item/Movie/dictionary; SearchIndexState active pointer.

**Выход:** Search document version1; sync checkpoint только после succeeded; isolated bisky_movies_v1_generation индекс через APP_NAME target.

**Поля, индексы, инварианты:** ISearchTaskResult={taskUid,status:succeeded}; failed/error/timeout бросает typed error. Проверять createIndex/settings/upsert/delete tasks, не только последний task. Writer rereads current revision, lease loss не запускает конкурирующего writer до drain/recovery. Recovery scan Mongo decision tail при lost enqueue. Rebuild pause catalog writes+writer, full scan stable _id → new index → verify → pointer CAS; failed keeps old active. Старые индексы не удаляются автоматически..

**Зависимости:** P2.4/P2.5,P1.3,D2/D13; сервер Meilisearch версия/сортировки в P6.

**Критерий готовности:** Повтор безопасен после succeeded до checkpoint, old job не возвращает старые bytes, excluded/redirect IDs delete; dictionary changes затрагивают связанный каталог. Job name catalog.search.sync/version1, payload targetSequence либо rebuildId, без JSON пакета..

**Разрешённые проверки:** S0/S1/S2; R: failed task/lost jobs/index loss/pointer failure — P6.1.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P2.7. Публичный каталог, поиск и согласованный filter DTO

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/catalog/catalog.module.ts`
- Создать новый: `apps/api/src/endpoints/catalog/controllers/catalog.controller.ts`
- Создать новый: `apps/api/src/endpoints/catalog/services/catalog.service.ts`
- Создать новый: `apps/api/src/endpoints/catalog/dto/movieFilters.dto.ts`
- Создать новый: `apps/api/src/endpoints/catalog/dto/catalogQuery.dto.ts`
- Создать новый: `apps/api/src/endpoints/catalog/dto/movie.dto.ts`
- Изменить существующий: `apps/api/src/app/app.module.ts`

**Ответственность:** Movie-only public HTTP и allowlisted mapping.

**Вход:** GET /catalog/movies query/filters/limit1..100/offset>=0/locale; GET /catalog/movies/:id; D14 filter DTO.

**Выход:** canonical id/revision + selected title actualLocale/role + allowed Movie fields; requested/resolved IDs при разрешённом redirect.

**Поля, индексы, инварианты:** Search titlesRu/En/originals/aliases+accepted tag labels/aliases; filter type/tagKeys/year/runtime/country/language+allowlisted typed Features. Recheck Mongo revision/control/material blocks+filters after hits; no exact total after dropped stale hits. query<=200; unknown filters400, forbidden card404, nonempty query search failure503; empty Mongo fallback только реализованные predicates + degraded..

**Зависимости:** P2.6/P1.1,D14; no P3 auth for public catalog.

**Критерий готовности:** RU/EN/alias/missing locale дают один ID; raw/AI/notes не публичны, каталог не exposure. Live stale/redirect control gate authoritative. Рекомендации P5 используют тот же MovieFiltersDto после принятия D14..

**Разрешённые проверки:** S0/S1/S2; R: search locale/alias/filter/stale/failed backend — P6.1.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

## P3 — обычный аккаунт, постоянный код, сессии, Яндекс/Google и необязательное email recovery

### P3.1. Browser proof, конфигурация и живой доступ

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/auth/auth.module.ts`
- Создать новый: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Создать новый: `apps/api/src/endpoints/auth/services/authBrowser.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/guards/liveSession.guard.ts`
- Создать новый: `apps/api/src/endpoints/auth/services/authSession.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/auth.dto.ts`
- Изменить существующий: `apps/api/src/infrastructure/security/types/IAuthPrincipal.ts`
- Изменить существующий: `apps/api/src/infrastructure/config/functions/createInfrastructureConfiguration/core/createInfrastructureConfiguration.ts`
- Изменить существующий: `apps/api/src/infrastructure/config/services/config.service.ts`
- Изменить существующий: `apps/api/src/infrastructure/logger/functions/redactLogValue/core/redactLogValue.ts`
- Изменить существующий: `apps/api/src/main.ts`
- Изменить существующий: `apps/api/.env.example`
- Изменить существующий: `apps/api/src/app/app.module.ts`
- Изменить существующий: `apps/api/src/infrastructure/security/services/jwt.service.ts`
- Изменить существующий: `apps/api/src/infrastructure/security/types/IRefreshTokenPayload.ts`
- Изменить существующий: `apps/api/src/infrastructure/security/static/JWT_REFRESH_EXPIRATION.ts`

**Ответственность:** JWT guard + endpoint-owned live Session guard/browser/CSRF proof; composition без обратных imports.

**Вход:** GET /auth/bootstrap, GET /auth/methods; server region P3.4; browser proof для register/cookie endpoints.

**Выход:** Bound browser proof без создания User; MeDto/AuthDto allowlist; no-store; principal из live User/Session; fixed refresh claims signer и new Session issuance primitive для P3.2.

**Поля, индексы, инварианты:** Allowlisted origin/CSRF header, host-only HttpOnly refresh Path=/auth SameSite=Lax, Secure HTTPS с явно local HTTP исключением. App dev CORS true не считать authority; endpoints проверяют свои origin allowlists. Receipt/PKCE AEAD отдельный config key+keyVersion, browser proof integrity server secret, token cookie parsing/serialization совместимые Fastify5 средства: dependency @fastify/cookie только если принято D7 и нужна реализация, lock обновлять scoped. Redactor покрывает accessCode/credential/PKCE/handoff/reauthProof, не только token/secret; не логировать private payload.; signer принимает fixed iat/exp,jti,rotation, four-month UTC clamp вместо30d, SHA256 refresh и unique random jti; primitive createSession не включает rotation HTTP.

**Зависимости:** P1.4,D7/D9; P2 operator доступ не выдаёт /me foreign permission.

**Критерий готовности:** AccessTokenGuard остаётся portable JWT-only; LiveSessionGuard query Session/User, roles/permissions live. Запись дополнительно проверяет и изменяет Session revision в transaction. .env.example новые keys сгруппированы с source/generation комментарием, реальные .env secrets не менять..

**Разрешённые проверки:** S0/S1/S2; R: CSRF/origin/revoke/owner denial — P6.2.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P3.2. Локальная регистрация, login и перевыпуск кода

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/auth/services/authAccount.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/services/authCredentialReceipt.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/services/authReauthentication.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/register.dto.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/codeLogin.dto.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/regenerateCode.dto.ts`
- Дополнить новый из P3.1: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Создать новый: `apps/api/src/endpoints/auth/controllers/account.controller.ts`

**Ответственность:** Обычный account и защищённый delivery/retry секрета.

**Вход:** POST /auth/register {operationId,locale,email?}; POST /auth/code/login {operationId,login,accessCode}; POST /me/access-code/regenerate {operationId,expectedCredentialVersion,reauthProof}.

**Выход:** AuthDto+cookie, login/accessCode только register/regenerate/recovery или защищённый retry; audit/receipts.

**Поля, индексы, инварианты:** 24 random bytes/32base64url, bcrypt12 через hashValue/compareHash; username generated unique,role=user,catalogPermissions empty. Reauth current code либо принятого provider grant D15; CAS credentialVersion,hash+audit+revoke всех sessions+replacement one transaction. receipt AEAD с binding/digest/5m; dummy comparison для неизвестного login, одинаковые credential errors; account/source limits D7..

**Зависимости:** P3.1/P1.4,D7/D15; P3.1 token/session primitives.

**Критерий готовности:** Retry после commit возвращает тот же user/code/result IDs, другой payload409; raw code нигде не сохраняется open/URL/log. Provider-only enable допускает version0; login не раскрывает raw код; потеря доступа не создаёт support bypass..

**Разрешённые проверки:** S0/S1; R: retry/race/lost answer/wrong code/privacy — P6.2.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P3.3. Rolling refresh, rotation, logout и sessions

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Дополнить новый из P3.1: `apps/api/src/endpoints/auth/services/authSession.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/refresh.dto.ts`
- Дополнить новый из P3.1: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Дополнить новый из P3.2: `apps/api/src/endpoints/auth/controllers/account.controller.ts`

**Ответственность:** Refresh rotation/reuse/logout/session HTTP поверх primitives P3.1.

**Вход:** POST /auth/refresh {operationId}+cookie/proof, /auth/logout, GET /me/sessions, DELETE /me/sessions/:id, GET /me.

**Выход:** AuthDto и cookie с fixed claims generation; owner session list; immediate revoke для последующих guarded requests.

**Поля, индексы, инварианты:** Refresh sub/sessionId/type/jti/rotation+fixed iat/exp; SHA256 полного token, Session CAS; четыре месяца UTC clamp предложено, access15m. Один rotationReceipt 30s с previousHash/from-to/nextJti/iat/exp/digest/op, точный retry то же generation/hash. Reuse revoke отдельно committed до401; чужой непроверенный token не отзывает session. Сохранять Session _id семьи..

**Зависимости:** P3.1/P3.2/P1.4,D7; primitive token issuance уже P3.1.

**Критерий готовности:** Same-second refresh различим jti; exact retry не продлевает expiry; concurrent different op не даёт две успешные generation. Session month expiry не удаляет User. Logout повтор204, чужая session404..

**Разрешённые проверки:** S0/S1; R: month-end, concurrent refresh, lost response/reuse/revoke+write race — P6.2.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P3.4. Яндекс/Google, региональная политика и linking

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/auth/services/authRegion.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/services/authProvider.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/services/googleIdentity.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/services/yandexIdentity.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/providerAttempt.dto.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/googleCredential.dto.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/yandexComplete.dto.ts`
- Дополнить новый из P3.1: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Дополнить новый из P3.1: `apps/api/src/endpoints/auth/auth.module.ts`
- Изменить существующий: `apps/api/src/infrastructure/config/functions/createInfrastructureConfiguration/core/createInfrastructureConfiguration.ts`
- Изменить существующий: `apps/api/.env.example`
- Изменить существующий: `apps/api/package.json`
- Изменить существующий: `apps/api/pnpm-lock.yaml`

**Ответственность:** Server identity verification, попытки/reauth/link/sign_in; не внешнее создание OAuth проектов.

**Вход:** POST /auth/:provider/attempts, POST /auth/google {attemptId,credential}; GET /auth/yandex/callback {code,state}; POST /auth/yandex/complete {attemptId,handoff}.

**Выход:** created/signed_in/linked + прежний/new User ID/AuthDto; reauth proof как D15; region methods response.

**Поля, индексы, инварианты:** Region из trusted edge/IP config, не client header; RF/unknown block Google повторно на completion/link/reauth. Google signature/iss/aud/exp+nonce/sub официальным verifier, свежесть отдельно. Yandex code/state/PKCE S256/profile.id, ephemeral token; allowlisted redirect+short browser-bound handoff, no JWT URL. OAuth browser/owner binding and expiry; choose state storage and retry behavior during implementation without a mandatory MongoDB collection; linkedAccount lookup $elemMatch, whole-array set/CAS, DB unique race reread. Идентичный email не link..

**Зависимости:** P3.1–P3.3/P1.4,D8/D9/D15; missing credentials блокируют реальный flow, не создают fake runtime status.

**Критерий готовности:** Region enforcement API, duplicate identity один user, link чужой409, sign_in switch без merge; external code exchange вне transaction и consumed-code crash новая attempt. При доступности проверять официальный verifier version against installed Node before new dependency..

**Разрешённые проверки:** S0/S1/S2; R: оба real providers, region deny, state/nonce/expiry, link race/switch — P6.2.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P3.5. Необязательный verified email recovery

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/auth/services/authRecovery.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/services/authRecoveryDelivery.service.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/recoveryEmail.dto.ts`
- Создать новый: `apps/api/src/endpoints/auth/dto/recoveryComplete.dto.ts`
- Дополнить новый из P3.1: `apps/api/src/endpoints/auth/controllers/auth.controller.ts`
- Дополнить новый из P3.2: `apps/api/src/endpoints/auth/controllers/account.controller.ts`
- Дополнить новый из P3.1: `apps/api/src/endpoints/auth/auth.module.ts`

**Ответственность:** Verification/reset и доставка через текущий queue-only mail flow.

**Вход:** PUT /me/recovery-email с fresh proof; POST /auth/recovery-email/verify token; POST /auth/recovery/email/start {login,email}; POST /auth/recovery/complete {operationId,token}.

**Выход:** 202 start без enumeration, verified email; reset выдаёт новый code+Session/receipt после consume.

**Поля, индексы, инварианты:** RecoveryChallenge hash/purpose/owner/email/credentialVersion/expiry30m/consumed; смена email сохраняет прежний verified до нового proof, старые challenges revoke. Mail token bytes защищённо сохраняются для dispatch до enqueue вне callback; delivery state scanner retries без генерации второго challenge. Notification/reset через MailService.send; добавить template functions внутри service если нужны, без нового mail transport. После версии/reset race challenge невалиден..

**Зависимости:** P3.2/P3.3/P3.4 reauth,D10/D4; Resend mail/domain credentials для real delivery.

**Критерий готовности:** GET link scanner не consumes; no plaintext accessCode в письме; no auto-verified provider email; reset one-time race один commit, все sessions revoke. Lost enqueue/delivery не равен completed recovery; real sent observation отдельно от queue status..

**Разрешённые проверки:** S0/S1; R: delivery, expired/race challenge, loss all methods, uniform start — P6.2.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

## P4 — библиотека, согласованные события и feedback

### P4.1. Immutable feature basis до первого события

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/entities/movie/functions/prepareMovieFeatures/core/prepareMovieFeatures.ts`
- Создать новый: `apps/api/src/entities/movie/functions/prepareMovieFeatures/index.ts`
- Создать новый: `apps/api/src/entities/movie/functions/prepareMovieFeatures/types/IMovieFeatureBasis.ts`
- Создать новый: `apps/api/src/entities/movie/functions/prepareMovieFeatures/static/MOVIE_FEATURE_MANIFEST.ts`
- Создать новый: `apps/api/src/endpoints/library/services/libraryFeatureBasis.service.ts`
- Создать новый: `apps/api/src/endpoints/library/library.module.ts`

**Ответственность:** Чистая подготовка plain Movie features + endpoint-owned snapshot IO; это входы, не ranking.

**Вход:** Published Movie/ItemTag/ItemFeature/dictionary revisions или accepted exposure basis; movie-features/1 manifest.

**Выход:** FeatureBasisRef+digest+конкретные x/a/definitions/catalogRevision/identityBasis либо empty reason; reusable RecommendationSnapshot catalog kind с bounded chunks.

**Поля, индексы, инварианты:** Бюджеты tags0.8/features0.2, bins длительности/десятилетия/string/boolean и allowlist из proposed §3 рекомендаций. Derived runtime один источник, no notes/aliases as duplicate signal. Bytes сохранить и проверить вне transaction; внутри команды CAS проверяет те же source revisions/identity, иначе повтор подготовки, orphan artifact отчёт. Если feedback — frozen показанный basis, не сегодняшний Movie..

**Зависимости:** P1.6/P2 published data, D12/D4; P3 live owner для публикации event, не нужен scorer P5.

**Критерий готовности:** Каждое changed rating/favorite/saved имеет durable basis/ref/version; clear сохраняет отменяемый lineage/basis ref где нужен replay; exposure всегда basis. Нет обещания exact replay прежнего события без bytes..

**Разрешённые проверки:** S0/S1; R: update Movie после оценки не меняет её frozen basis — P6.3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P4.2. Command union, переходы и атомарный event receipt

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Дополнить новый из P4.1: `apps/api/src/endpoints/library/library.module.ts`
- Создать новый: `apps/api/src/endpoints/library/controllers/library.controller.ts`
- Создать новый: `apps/api/src/endpoints/library/dto/libraryCommand.dto.ts`
- Создать новый: `apps/api/src/endpoints/library/dto/libraryItem.dto.ts`
- Создать новый: `apps/api/src/endpoints/library/services/libraryCommand.service.ts`
- Создать новый: `apps/api/src/endpoints/library/functions/applyLibraryCommand/core/applyLibraryCommand.ts`
- Создать новый: `apps/api/src/endpoints/library/functions/applyLibraryCommand/index.ts`
- Создать новый: `apps/api/src/endpoints/library/functions/applyLibraryCommand/types/ILibraryCommand.ts`
- Изменить существующий: `apps/api/src/infrastructure/logger/decorators/AppExceptionFilter/static/ERROR_CODES.ts`
- Изменить существующий: `apps/api/src/infrastructure/logger/decorators/AppExceptionFilter/types/TErrorCode.ts`
- Изменить существующий: `apps/api/src/app/app.module.ts`

**Ответственность:** Library state transitions + append-only UserAction, owner transaction.

**Вход:** POST /me/library/movies/:itemId/actions CommandDto={eventId,schemaVersion1,expectedRevision,occurredAt?,kind,payload,context}; verified principal.

**Выход:** AcceptedActionDto{eventId,sequence,recordedAt,resultingRevision,changed,result,replayed}; current projection + audit.

**Поля, индексы, инварианты:** saved/status.set-clear/rating.set-clear/favorite.set/note.set-clear/attempt.start-status-progress-remove/not_interested.set-clear/skipped. rating integer1..10; note<=5000; minute safe integer; <=1 open attempt, terminal no reopen, clear status with open409, completed without start unknown dates/progress, repeat new attemptId. digest включает отсутствие occurredAt и original path/context. Receipt before stale/redirect; event/state/User sequence/live Session/fences одна transaction; duplicate-key reread after abort..

**Зависимости:** P4.1/P1.5/P3 guards,D11; skipped handler P4.4.

**Критерий готовности:** No-op new eventId accepted changed=false без второго signal; same eventId/different digest409; same revision race один успех. Все пять статусов и независимые clear сохраняют соседние поля; orphan projection tombstone revision не сбрасывается. Новые error codes составляют existing envelope, не arbitrary unchecked string..

**Разрешённые проверки:** S0/S1/S2; R: transitions/no-op/CAS/unknown commit/revoke race — P6.2.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P4.3. Owner чтение, история и split lineage

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/library/services/libraryRead.service.ts`
- Создать новый: `apps/api/src/endpoints/library/services/libraryIdentityProjection.service.ts`
- Создать новый: `apps/api/src/endpoints/library/dto/libraryQuery.dto.ts`
- Создать новый: `apps/api/src/endpoints/library/dto/actionHistory.dto.ts`
- Дополнить новый из P4.2: `apps/api/src/endpoints/library/controllers/library.controller.ts`

**Ответственность:** Lazy identity projection до записи, приватная history/read без operator note access.

**Вход:** GET /me/library/movies (page,limit,status,favorite,rated,locale), /:itemId; GET /me/actions afterSequence/itemId; /:eventId; CatalogDecision mapping.

**Выход:** LibraryItemDto с stateRevision/projectionBasis/lineageConflicts и owner own attempts; AcceptedAction historical receipt.

**Поля, индексы, инварианты:** Stable updatedAt desc+_id desc для library, sequence asc cursor для events. Direct даже clear/false > copied; latest original sequence tie-break только без direct; alternatives/private history сохраняются, attempt union original ID+source event. Catalogue forbidden card stub без titles/poster/raw; прежний owner state редактируем, новая связь к forbidden reject. Catalog mapping не содержит чужих notes; no fabricated UserAction/exposure..

**Зависимости:** P4.2/P2.5,D11/D13.

**Критерий готовности:** Projection basis refresh повышает revision до новой команды, stale409; merge одна group, split исходные IDs и собственные значения; separate not_interested clear A не снимает B. History foreign404, admin/catalog permission не owner bypass..

**Разрешённые проверки:** S0/S1; R: direct/copied/clear conflicts, history owner and excluded stub — P6.2/3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P4.4. Receiver показов и feedback hard policy

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/library/controllers/recommendationExposure.controller.ts`
- Создать новый: `apps/api/src/endpoints/library/dto/recommendationExposure.dto.ts`
- Создать новый: `apps/api/src/endpoints/library/services/recommendationExposure.service.ts`
- Создать новый: `apps/api/src/endpoints/library/services/recommendationFeedback.service.ts`
- Создать новый: `apps/api/src/entities/userRecommendationState/static/COOLDOWN_POLICY.ts`
- Дополнить новый из P4.1: `apps/api/src/endpoints/library/library.module.ts`

**Ответственность:** Accepted shown/exposure и проверенный attribution, без request producer.

**Вход:** POST /me/recommendation-exposures ExposureDto={exposureId,schemaVersion:1,requestId,resultKey,occurredAt?,displayContext}; feedback через прежний library CommandDto/context.exposureId.

**Выход:** Exposure+UserAction shown(eventId=exposureId) один sequence/receipt; synchronous RecommendationState deadlines/exclusion.

**Поля, индексы, инварианты:** Проверить completed owner request+resultKey+issued identity+basis; live authority/fence requested-resolved sorted +User/actionSequence+live Session в transaction. Точный retry до live gate. 24h shown/7d skipped от server recordedAt; max deadlines, policyVersion и конкретный deadline в event. not_interested durable/null shown before any exposure; clear не обнуляет cooldown. One skipped per exposure: новый eventId conflict, duplicate original receipt..

**Зависимости:** P4.1–P4.3/P1 request schemas,D11/D12; completed request producer P5.4 для успеха R.

**Критерий готовности:** Не создавать fake request для закрытия P4. Без request receiver409/404 как контракт; finished runtime только P6 после P5. Feedback foreign404/mismatch409; library rating without exposure не attribution. Exposure race forbidden before commit reject; после commit retry сохраняет принятое событие. EventId namespace collision с другим kind409..

**Разрешённые проверки:** S0/S1/S2; R: issued != shown, duplicate/foreign/skip/not_interested/race — P6.3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P4.5. Durable хвост для будущих проекций

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/library/services/libraryProjectionInput.service.ts`
- Дополнить новый из P4.1: `apps/api/src/endpoints/library/library.module.ts`

**Ответственность:** Reader committed journal+identity checkpoint; P5 dispatcher использует этот reader.

**Вход:** user/afterSequence/cutoff+catalogSequence; supported schemaVersion.

**Выход:** Упорядоченный поток input events с feature refs и контроль sequence gaps; источник rebuild/lag comparison.

**Поля, индексы, инварианты:** User.actionSequence и projection checkpoints не queue counters; service query filters explicit owner/system task scope. Не держать events/notes в taste snapshot. Lost enqueue после commit остаётся восстанавливаемым из Mongo, dispatcher будет P5; менять userAction bytes не требуется..

**Зависимости:** P4.2–P4.4,D11/D13.

**Критерий готовности:** Input может восстановить library/hard states, политику deadlines и feature basis; неизвестная version/gap fail, не skip с повышением checkpoint..

**Разрешённые проверки:** S0/S1; R: crash commit→enqueue и sequence gap — P6.3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

## P5 — профиль вкуса, две стратегии, история рекомендаций и пересборки

### P5.2. Метрики, согласованный source cut и generations

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/recommendations/services/recommendationSourceCut.service.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/services/itemMetricProjection.service.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/services/recommendationStateProjection.service.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/services/recommendationProjectionManifest.service.ts`

**Ответственность:** Consistent input, scratch generations, hard state replay/CAS.

**Вход:** Все пользователи cutoff membership+(userId,actionSequence), catalogSequence, changed effective contributions/exposures.

**Выход:** item-metrics/1 generation+active pointer, recommendation-state/1 rebuilt counters/deadlines без сдвига времени.

**Поля, индексы, инварианты:** Снять cutoff membership/vector в short snapshot read transaction, durable chunks вне её: читать immutable events до cut; новые users/events delta следующего cut. Views distinct accepted exposure, rating integer histogram current effective user/identity, favorites/status counts distinct; internal P distinct30d evidence, не lifetime views. Ambiguous item-local signals unresolved once outside both counts (D13). Scratch metric unique generation/item; CAS pointer no mixed gen; source manifest+digest+checkpoints/lease; state publish compares live revision..

**Зависимости:** P4.5/P1.6,D13.

**Критерий готовности:** Retry set computed result не increments per delivery; snapshot source membership consistent, invalid/gap/missing artifact fail preserving active generation. Долгий полный rebuild не одна transaction. Catch-up before publish или честный lagging generation в snapshot без live hard gate weakening..

**Разрешённые проверки:** S0/S1; R: metric clear/change, copy unresolved, new user/action during rebuild, failed swap — P6.3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P5.1. Effective evidence, taste centres и profile publish

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/entities/userTasteProfile/functions/calculateTasteProfile/core/calculateTasteProfile.ts`
- Создать новый: `apps/api/src/entities/userTasteProfile/functions/calculateTasteProfile/index.ts`
- Создать новый: `apps/api/src/entities/userTasteProfile/functions/calculateTasteProfile/types/ITasteCalculationInput.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/services/tasteProjection.service.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/recommendations.module.ts`

**Ответственность:** Чистый профиль + owning CAS публикация scratch.

**Вход:** Committed action cut+CatalogDecision basis+frozen features; D12 selected formulas/versions.

**Выход:** taste-centers/1 concrete centres/global negative preferences, profile digest/checkpoints/evidence refs.

**Поля, индексы, инварианты:** По §5/6 дизайна один effective evidence на identity/group, rating>favorite>saved, no-op/show/skip/status/note не taste. y/h/m/s/c/t/b раздельно, saturation finite; weighted Jaccard complete-link/forced merge K<=3, deterministic IDs/thresholds. Ambiguous copy once with frozen original basis, replaced copies deactivate original when all cleared; direct new rating independent identity evidence. Scratch bytes outside publication, short CAS source revision/cut+identity unchanged..

**Зависимости:** P4.1/P4.3/P4.5,D12/D13; source-cut reader P5.2 выполняется прежде profile publish.

**Критерий готовности:** Repeat same cut/version digest yields same профиль; cleared ratings remove contribution; concurrent new exclusion не overwrite. Profiles may lag explicitly, hard gates live..

**Разрешённые проверки:** S0/S1; R: single rating 1/10/50tags, two interests, clear conflicts, deterministic rebuild — P6.3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P5.3. Plain engine, baseline и персональная стратегия

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/shared/recommendationEngine/core/recommendationEngine.ts`
- Создать новый: `apps/api/src/shared/recommendationEngine/index.ts`
- Создать новый: `apps/api/src/shared/recommendationEngine/types/IRecommendationEngineInput.ts`
- Создать новый: `apps/api/src/shared/recommendationEngine/types/IRecommendationEngineOutput.ts`
- Создать новый: `apps/api/src/shared/recommendationEngine/functions/scoreBaseline.ts`
- Создать новый: `apps/api/src/shared/recommendationEngine/functions/scorePersonal.ts`
- Создать новый: `apps/api/src/shared/recommendationEngine/functions/selectRecommendationLanes.ts`
- Создать новый: `apps/api/src/shared/recommendationEngine/static/RECOMMENDATION_VERSION_MANIFEST.ts`

**Ответственность:** Portable deterministic ranking на входных values, без Movie/Mongoose/IO.

**Вход:** EngineInput context/evaluationTime/seed/versions/parameters/candidates/profile/state/recent exposures/identity/manifest.

**Выход:** EngineOutput ordered candidates/resultKey/rank/components/centres/lane/reasons/shortages, baseline/1 и tag-centers/1.

**Поля, индексы, инварианты:** Весь proposed §§3–7 bundle D12: N/df/d, Q shrinkage/scales/counts, P channels, K,B; A,D,alpha; R/H/I/diversity; Kmax3/epsilon.2 и принятые hard gates. L>=centres matching unique reserve, малые L least-served sequence, floor quotas и fifth exposure exploration остаются предложением. score quantize1e-9/stable sum order/hash(seed,lane,type,id). Version manifest concrete parameters/feature/profile/metric/state/cooldown/candidate versions + восстановимый code artifact..

**Зависимости:** P5.1/P5.2/P4.1,D12/D13; внешние channels D3 иначе явно disabled.

**Критерий готовности:** Обе стратегии общий input/output, одинаковые eligible candidates, no ambient random, bounded confidence от одной оценки, no hard dislike тега. Baseline ignores taste. Фильтры режимов/24h/7d не обсуждаются заново; остальные coefficients не подменять без принятия D12..

**Разрешённые проверки:** S0/S1; R: same bytes/seed shuffled order, two interests, saturation/skip decay — P6.3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P5.4. Snapshots и owner request producer

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/recommendations/controllers/recommendations.controller.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/dto/recommendationRequest.dto.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/dto/recommendationResult.dto.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/services/movieRecommendationInput.service.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/services/recommendationSnapshot.service.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/services/recommendationRequest.service.ts`
- Дополнить новый из P5.1: `apps/api/src/endpoints/recommendations/recommendations.module.ts`
- Изменить существующий: `apps/api/src/app/app.module.ts`

**Ответственность:** Movie adapter/immutable IO/request state machine/live gate.

**Вход:** POST /me/recommendations {requestId,schemaVersion:1,strategyId,mode,types:[movie],locale,filters,limit1..50,seed?}; principal.

**Выход:** Completed request receipt +returned results distinct от calculated ranking; pending/failed recoverable states.

**Поля, индексы, инварианты:** Adapter consumes Movie features P4.1 +sourceMetrics/activeMetricsGeneration/profile/recent exposures/library hard state. Full candidate/catalog snapshot до personal фильтров +profile concrete/context deadlines/frozen exposures/definitions/Ndfd/channel observations/time/seed/version/code chunks. Store/verify bytes outside transaction; final gate fences+User basis/live Session short transaction recheck candidates and record actual returned IDs/order/removals. Use same MovieFiltersDto D14. Privacy/no notes/foreign IDs in API..

**Зависимости:** P5.1–P5.3/P2.7/P4.4,D12/D13/D14.

**Критерий готовности:** Same user/requestId intent returns original receipt, different409; crash pending resumes saved manifest/time/seed или failed reason, не новый случайный расчёт под тем же ID. Прежде completed все refs доступны. Authority failure503; shortage без forbidden filler. now gate и exposure later gate разные..

**Разрешённые проверки:** S0/S1/S2; R: requests/retry/live gate/owner isolation/stale exposure — P6.3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P5.5. Replay и сравнение двух стратегий

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/recommendations/services/recommendationReplay.service.ts`
- Дополнить новый из P5.4: `apps/api/src/endpoints/recommendations/controllers/recommendations.controller.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/dto/recommendationHistory.dto.ts`
- Дополнить новый из P2.1: `apps/api/src/endpoints/catalogManagement/services/catalogCommand.service.ts`

**Ответственность:** Historical replay/comparison без изменения immutable receipts.

**Вход:** Owner GET /me/recommendations/:requestId и GET /me/recommendations?cursor&limit; CLI compare/replay с explicit owner-authorized/isolated scope.

**Выход:** Два request IDs+compareGroupId на одинаковых catalog/profile/context/evaluationTime/seed; replay output digest/report.

**Поля, индексы, инварианты:** GET history/replay input allowlist no private raw refs URLs; snapshots not current Movie. Исторический calculatedRanking compare отдельно от returnedResults liveGateBasis. Fixed implementation bytes/manifest версии, supported old code registry; missing artifact/version yields explicit not_replayable error, не silent current-data fallback. Refresh new features/profile produces new revision/output IDs. Read только своих requests; catalog permission само не чужой owner history..

**Зависимости:** P5.4/P3 live owner,D13/D4.

**Критерий готовности:** After Movie/profile change same version exact replay совпадает; feedback ссылки на exposure остаются прежними. Старые forbidden public title/poster не возвращать из historical bytes; replay numeric metadata allowed owner. CLI compare scope не открывает оператору private note/history..

**Разрешённые проверки:** S0/S1; R: equal bytes pair, update inputs then replay, missing artifact/version — P6.3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P5.6. Jobs, recovery scanner и rebuild commands

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `apps/api/src/endpoints/recommendations/handlers/userProjectionJob.handler.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/handlers/itemMetricProjectionJob.handler.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/static/USER_PROJECTION_JOB.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/static/ITEM_METRIC_PROJECTION_JOB.ts`
- Создать новый: `apps/api/src/endpoints/recommendations/services/recommendationRecovery.service.ts`
- Дополнить новый из P5.1: `apps/api/src/endpoints/recommendations/recommendations.module.ts`
- Дополнить новый из P2.1: `apps/api/src/endpoints/catalogManagement/services/catalogCommand.service.ts`

**Ответственность:** Повторяемая доставка и локальная служебная orchestration.

**Вход:** Committed User.actionSequence/identity basis/manifest или metrics generation/source cut.

**Выход:** jobs user.projection.rebuild и item.metric.rebuild version1, payload только owner/cut/manifest IDs; durable progress.

**Поля, индексы, инварианты:** Recovery scanner сравнивает Mongo checkpoints, обнаруживает lost enqueue и pending request/rebuild; scheduled scan через текущий SchedulerModule с owner module provider, не cron import AI. Key=(user,projectionVersion,targetSeq,basis) либо generation/catalogSeq/cutDigest; encode/hash jobId без запрещённых BullMQ разделителей. concurrency10 не гарантия порядка, lease/CAS+digests correctness. Cancel между chunks, source cut остаётся, active gen unchanged; NonRetryable invalid/gap/missing supported source, transient IO retry..

**Зависимости:** P5.1/P5.2/P5.4/P4.5,D13.

**Критерий готовности:** Потеря Redis/удаление retained jobs не теряет history; retry после publish no-op; tail catches new action/catalog decision; sync hard state не зависит от scanner. Rebuild CLI service scope audit, не owner data dump..

**Разрешённые проверки:** S0/S1/S2; R: Redis outage/lost enqueue/double delivery/cancel/CAS race — P6.3.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

## P6 — локальная приёмка полного цикла

### P6.1. Изоляция и полный каталоговый цикл

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Создать новый: `docs/mvpImplementationPlan.md`
- Создать новый: `apps/api/demo/acceptance/environment.json`
- Создать новый: `apps/api/demo/acceptance/catalog.json`

**Ответственность:** Локальная ручная приёмка, запись evidence; никаких тестовых runner/files.

**Вход:** Отдельное явное runtime разрешение чата 11, принятые D/готовый build P1–P5; разрешённый real source набор или synthetic subset.

**Выход:** Таблица target isolation + observed CLI/HTTP/artifact hashes/counts/decision IDs/search checkpoints для DoD1–4/8/11.

**Поля, индексы, инварианты:** До writes установить Mongo version/FCV/set primary/session permissions/transaction concerns/listIndexes в isolated DB; отдельные Redis DB/prefix, APP_NAME bucket/JWT/cache/queue, search namespace/master-key scope и private artifact policy. Не выводить URI credentials/keys. Создать declared collections/indexes на isolated target, подтвердить rollback two-document transaction на isolated probe, не на рабочей БД. operator-bootstrap → Source/dictionary bootstrap → dry-run → stage/apply → search sync/rebuild → HTTP catalog..

**Зависимости:** P1–P5 статически проверены; D3/D5/D6; runtime фактически разрешён в чате, сейчас нет.

**Критерий готовности:** Наблюдать shared IDs/pending/remake, тот же/new package no duplicate, override/exclusion повтор, provenance pointers/bytes/rules, missing translation/aliases, corrupted package, partial/cancel, stale revisions, upload→commit→enqueue/task→checkpoint failures, index loss+failed rebuild сохраняет active. Synthetic-only отмечать как неподтверждённую реальную часть, не все DoD pass..

**Разрешённые проверки:** R; после исправления in-scope production соответствующие S1/S2 и только затронутый R; evidence sanitized.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P6.2. Обычный аккаунт и вся библиотека

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Дополнить новый из P6.1: `docs/mvpImplementationPlan.md`
- Создать новый: `apps/api/demo/acceptance/account-library.json`

**Ответственность:** HTTP/browser/manual provider/recovery приёмка текущего пути DoD5/6.

**Вход:** Изолированное окружение P6.1; два разных обычных account, готовые actual provider apps/credentials и mail, local browser GIS harness.

**Выход:** Observed status codes/stable user IDs/sequence/revisions/IDs/revoke/expires events без code/token/private notes в evidence.

**Поля, индексы, инварианты:** Register → retry → login/refresh → library history → link same ID → switch other → old account return. Реальные Яндекс+Google отдельно в соответствующих server regions; RF/unknown прямые API deny, spoofed client header deny. Calendar month-end/rotation same second/concurrent/reuse/revoke mutation race; reauth/credential regenerate retry; verified email challenge/reset real delivery expiry/race; loss all methods refusal. Все status transitions/clear/rating bounds/favorite/note/minute progress/open-terminal attempts/rewatch/remove; no-op/digest conflict/CAS/foreign owner deny..

**Зависимости:** P6.1/P3/P4; actual provider credentials D8/D9/D10/D15.

**Критерий готовности:** Оба accounts сохраняют независимые данные, no temporary conversion обязательства. Real identity token/mail outcome observed, imitated flow не pass integration. Ни endpoint/operator не раскрывает чужие receipts/notes/code. Действующая Session не recovery proof для sensitive regenerate..

**Разрешённые проверки:** R manual; изоляция/browser заранее, не изменять apps/web ради harness; при отсутствии credentials конкретные blocked scenarios, не fake pass.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

### P6.3. Рекомендации, feedback, replay/rebuild и отмена merge

Статус: **не начато**; статически проверено: нет; runtime проверено: нет.

**Файлы**:

- Дополнить новый из P6.1: `docs/mvpImplementationPlan.md`
- Создать новый: `apps/api/demo/acceptance/recommendations.json`

**Ответственность:** End-to-end DoD7–11 + итоги всех 11 критериев.

**Вход:** Isolated seeded groups+users P6.1/2, approved formulas/manifests/retention; CLI replay/compare/rebuild.

**Выход:** Для каждого DoD expected/observed/status/evidence, версия bundle/seed/input digests/checkpoints; full cycle report.

**Поля, индексы, инварианты:** Baseline/personal equal frozen inputs/time/seed, engine order shuffled DB inputs deterministic; returned != shown; duplicate/foreign/mismatch feedback; cooldown exactly24h/7d/skip H half3d, unchanged taste after skipped, durable not_interested/live forbidden race. Two confirmed centres с distinct eligible candidates и overlap matching; L1 sequence accepted personal shows, exploration rounding отдельно; single rating/frequent tag saturation; новые оценки ranking expected/rebuild identical. Movie/profile update then exact replay, new calculation separate; absent bytes fail not invented. Merge/split before/after direct clear+copied alternatives/attempts/user event IDs/source IDs, frozen evidence once, unresolved item metric once, original deadlines. Lost Redis enqueue/double job/cancel, stale CAS, source membership race, failure before/after swap..

**Зависимости:** P6.1/P6.2/P5,D12/D13/D4.

**Критерий готовности:** Все 11 DoD runtime verified только с доказательствами и разрешёнными реальными материалами/integrations. Новое material contract обсуждать, обычный in-scope bug исправлять после необходимых skills. Account/история/exclusion не удаляются cleanup. Public deploy исключён..

**Разрешённые проверки:** R; issue result при неполной интеграции не объявлять MVP готовым; фиксировать точный blocker и сохранённые результаты.

- [ ] Зафиксировать принятый контракт и выполнить ограниченный файловый объём этой задачи.
- [ ] Проверить перечисленные инварианты и выходы; сохранить результаты разрешённых проверок и ограничения в строке прогресса.

## 6. Сквозные повторы, сбои и гарантии

| Граница | Durable authority / retry key | Что делать после сбоя | Владелец |
| --- | --- | --- | --- |
| Package → raw S3 → run metadata | ProcessingRun packageId/digest, сохранённые artifact IDs/hash/keys | Resume upload/verify; hash conflict reject; orphan только inventory без cleanup | P2.3 |
| Unit artifact → Mongo publication | CatalogDecision operationKey/contentDigest, revisions и assigned IDs | Receipt прежде stale check; unknown commit read same key, не повтор с новым ID; aborted transaction rollback всего unit | P2.4/5 |
| Mongo commit → JobService.add | Catalog sequence или User.actionSequence+projection manifest | Durable scanner дочитывает tail, повтор enqueue; queue IDs/dedup только оптимизация, blind increments запрещены | P2.6/P4.5/P5.6 |
| Job retry/out-of-order/cancel | Current Mongo state + basis/revision/digests/CAS | Per-unit/chunk cancel сохраняет commit; unsupported job version fail, новые definitions не бросают pending старые без явной процедуры | P2.3/6,P5.6 |
| Meilisearch task → checkpoint | succeeded task UID + canonical current revision/sequence | Failed/timeout не advance; repeated upsert/delete текущего состояния; writer drain после lease loss; full rebuild оставляет old pointer до проверки | P2.6 |
| Client command → Mongo state+event | owner/eventId/digest, expectedRevision, User sequence, live Session, Item fences | Exact retry receipt, different409, duplicate race reread после abort; неизвестный receipt read503 | P4.2/4 |
| Credential change → HTTP response | Bound encrypted receipt + op/digest/expiry/key version | В окне вернуть прежний code/outcome; вне окна не раскрывать секрет, требуется новое владение/recovery | P3.2/5 |
| Refresh commit → cookie loss | Session rotationReceipt+previousHash+operationId | Exact30s retry то же generation; reused signed token revokes committed отдельно от401 | P3.3 |
| Provider code exchange → attempt commit | Temporary OAuth state: state/nonce/browser/owner; choose storage in P3 | Exchange вне callback; consumed code может потребовать новый flow, не создавать второй User/relink по client claims | P3.4 |
| Challenge commit → mail enqueue/delivery | RecoveryChallenge deliveryState + защищённый token artifact | Диспетчер повторяет тот же challenge/send intent; письмо может доставляться повторно, consume только один; queue/sent не reset | P3.5 |
| Snapshot IO → completed request | Saved manifest/bytes/hash, requestId/intentDigest/time/seed | Pending resume с теми же inputs; failed concrete reason если bytes отсутствуют; no current-data replay под старым ID | P5.4/5 |
| Scratch projection → active swap | Immutable source cut + identity basis + generation/CAS | Old generation active до swap; change cut tail/retry, unknown commit digest lookup; new hard ban никогда не затереть | P5.1/2/6 |

Mongo транзакции не включают S3/Redis/Meilisearch/provider/mail вызовы. IDs/time/keys/hash prepare до повторяемого callback, операции session последовательно. Общей распределённой transaction не обещать. Commit order fences сериализует catalog/user gates; серверный accepted exposure не доказательство того, что stale bytes никогда не мелькали в браузере.

### Immutable dependency chain и версии

Published Movie/dictionary/source claims + identity decisions → P4 prepared feature basis bytes/hash/version → UserAction/Exposure frozen refs → effective evidence/profile/recent history → catalog/profile/context snapshots + code manifest → calculated ranking → live gate/returned results → accepted exposure → feedback. Удаление upstream bytes ломает конкретные downstream replay promises; refs без содержимого не evidence.

До **первого** changed taste event P4.1 нужны movie-features/1 allowlist/bins/family rules и immutable IO; до первого P5 completed request нужны taste-centers/1, item-metrics/1, recommendation-state/1, cooldown/1, full-movie/1, strategy baseline/1 или tag-centers/1, movie-recommendations/1 с concrete parameter JSON, snapshot schema1 и восстанавливаемая implementation manifest. Это предложенные имена bundle, отдельно принимаемые D12/D13. Data revisions/cutoffs не algorithm version. При изменении extraction/profile/schema повышать соответствующую version, не переписывать events/snapshots.

SourceArtifact и RecommendationSnapshot — разные метаданные, но один StorageService; FeatureBasisRef использует RecommendationSnapshot catalog-kind, не новую коллекцию под вектор. Активный код manifest необходимо сохранять immutable приватным artifact либо иной утверждённой восстановимой поставкой, без зависимости от обязательного Git commit. Старые версии выполнять только allowlisted registry, никогда загружать исполняемый код из клиентского manifest/AI JSON. Исторический snapshot не служит разрешением публично вернуть уже заблокированные тексты.

Политика cleanup пока не принята. Ни отсутствие TTL, ни этот план не утверждают бессрочное хранение. До D4 не добавлять автоматическое удаление; quarantine/unreferenced список можно показывать оператору, фактический delete требует известного scope и разрешения. После выбора retention сохранять closure dependencies либо честно отмечать affected request not_replayable/rebuild blocker; невозможность DoD3/7/11 нельзя скрыть сменой статуса. Аккаунты, journal, identity mapping и durable not_interested не попадают под общий material cleanup.

## 7. Матрица всех 11 DoD

Текущий статус каждого: **не начато**; runtime evidence нет. Будущая статическая проверка устанавливает структуру/контракты, но pass DoD даёт наблюдаемый R. Для сценариев фиксировать exact input hashes/версии/IDs, ожидаемый и наблюдаемый outcome, команду/HTTP status/cutoff без credentials/private текстов.

| DoD | Задачи | Локальная проверка и ожидаемый результат |
| --- | --- | --- |
| 1 canonical/dedup/ambiguity/remake | P1.1/3,P2.2/4/5,P6.1 | Два sources shared trusted ID → один Item; название без trusted evidence pending; ремейк иной ID; source uniqueness race не создаёт два canonical |
| 2 repeat/correction/exclusion | P1.3,P2.3–6,P6.1 | Тот же package и новый packageId с прежними records → 0 новых Item/bindings; override/block/exclusion переживают повтор; failed unit resume no double decision |
| 3 provenance/new rules stable identity | P1.1–3,P2.3–5,P4.1,P6.1/3 | Title/Feature → artifact hash/pointer+normalizer/AI result/decision; new reconciliation run сохраняет Item/user links/overrides; referenced bytes доступны, source missing явно blocker |
| 4 RU/EN/alias/fallback | P1.1/2,P2.6/7,P6.1 | RU/EN/saved alias возвращают один canonical ID, missing locale выдаёт actualLocale/role; blocked alias не публичный fallback; stale index не bypass |
| 5 актуальный ordinary account | P1.4,P3.1–5,P6.2 | Account/code возврат, rolling refresh; real Yandex/Google по region; link same ID, sign_in other без merge; regenerate/verified recovery/revoke и отказ без proof. Temporary conversion не требуется |
| 6 пять статусов/rating/favorite/note/rewatch/history/idempotence | P1.5,P4.1–5,P6.2 | Полный command union+minutes/повтор; clear не стирает соседние fields; before-after/events; duplicate same receipt, different payload409; CAS race один успех, no-op не вкус |
| 7 две стратегии/shared storage/replay/feedback | P1.6,P4.1/4,P5.3–6,P6.3 | Same bytes/time/seed/versions → воспроизводимые отдельные rankings; compareGroup на одинаковых входах; изменение Movie/profile не ломает старый replay; feedback accepted exposure refs; отсутствие bytes fail |
| 8 authority gates/issued-shown/skip not dislike | P1.1/5,P2.5–7,P4.4,P5.3/4,P6.3 | Оба engines без unavailable/excluded/not_interested; request без shown не count; accepted exposure one event; skip7d/shown24h server boundary, повтор after expiry, taste не изменён; race live gate/exposure |
| 9 два центра/single-rating/decay | P4.1,P5.1/3,P6.3 | Два confirmed interests и distinct eligible candidates → оба в L>=2 по approved reserve; overlap не потерян. L1 personal последовательность показов; одна оценка не уверенность всем тегам, skip similarity half3d не стирает taste |
| 10 update/rebuild profile | P4.5,P5.1/2/6,P6.3 | Контролируемые новые rating изменяют profile/ranking ожидаемо; тот же journal/basis/version → тот же digest; new events during scratch требуют catch-up/CAS, hard ban не overwritten |
| 11 erroneous merge reverse | P1.1/3/5,P2.5,P4.3/4,P5.1/2/5,P6.1/3 | Исходные A/B IDs/source bindings и late writes восстановлены; ambiguous lineage явно copy оба, direct приоритет+alternatives/attempts; исходные events/exposure IDs неизменны; taste once и unresolved metric once, old deadlines preserved |

Расчётные примеры дизайна — вход для expected outcomes, не готовые evidence. Числа реальной пользы/A-B uplift не DoD первого milestone.

## 8. Внешние решения и среда приёмки

| Зависимость | Что предоставить/выбрать | Граница подтверждения |
| --- | --- | --- |
| Movie sources | Названия двух источников, разрешённые JSON/snapshots/manual transcript, ID granularity/profiles, scales/counts/priorities/channels; минимум пересечение/conflict/ambiguous/remake/aliases/two interests | D3; сейчас не выбраны. Synthetic fixtures позволяют пройти кодовый путь, не подтвердить реальные источники |
| Google | Web OAuth client ID, GIS origins, consent/audience/test users, outbound keys, локальный browser callback-mode | GOOGLE_CLIENT_ID не secret; secret в GIS ID-token callback не нужен. Подпись/aud/iss/exp проверяет verifier, sub — identity; nonce/reauth proof отдельно. [Google server verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) |
| Яндекс | Registered client ID, exact callback URI, minimal login:info scope, app access, selected confidential secret и PKCE settings | Предложен code/state/PKCE S256; source API identity id, provider token только во время проверки. [Яндекс code flow](https://yandex.ru/dev/id/doc/ru/codes/code-url), [профиль](https://yandex.ru/dev/id/doc/ru/user-information) |
| Регион | Trusted edge/geo service/прокси, RF/outside/unknown, direct-header spoof policy; local-only controlled override для сценариев | Provider выбор принят, enforcement mechanism D9. Ни IP, ни выбор кнопки не юридическая гарантия; operator/age/content policy нужно отдельно определить до публичного запуска |
| Code/recovery | Принять length/hash/fresh proof/receipt AEAD keys+rotation/expiry, recovery challenges/delivery; verified email необязателен пользователю | D7/D10/D15. Реальные secrets не в документах; потеря key version receipts не восстанавливается выдуманным plaintext |
| Mongo | Separate local database+replica set/server/FCV/auth/concerns/indexes; transactions readiness | Standalone не обеспечивает нужные transactions; explicit session+callback retries. [MongoDB constraints](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/) |
| Search | Реальный Meilisearch server version/SDK compatibility, filter/sort config, isolated index namespace/permissions | Async enqueue не completed; ждать и проверять status всех tasks. [Meilisearch async operations](https://www.meilisearch.com/docs/capabilities/indexing/tasks_and_batches/async_operations) |
| Storage/Redis/mail | Private artifact bucket policy, isolated APP_NAME/queue/cache/Redis DB, S3-compatible Garage config, working Resend domain/key и recovery sender/redirect | Startup search/storage/health context может обращаться к services; runtime разрешение и isolation прежде Nest start. Queued не sent, sent не reset completed |

Совместимость проверена статически по source и lockfile; Context7 использован для Mongo transactions, Яндекса PKCE/code, Meilisearch tasks, официальная документация Google для server ID token verifier. Это не проверка OAuth приложений, legal policy, серверов или реального SDK исполнения. Перед реализацией новых dependencies сверять установленный runtime и exact verifier/cookie package version, не брать произвольную latest. Юридические формулировки старого дизайна не переносятся в утверждение готовности проекта.

## 9. Прогресс и условия перехода

| Этап | Реализация | Статически проверено | Runtime проверено | Следующий gate |
| --- | --- | --- | --- | --- |
| P1 | реализовано: P1.1–P1.6 | type-check, адресные ESLint/Prettier, build, AST/source review, diff-check: exit 0 | нет | P2 отдельно; до runtime — изолированные targets и deployed indexes |
| P2 | не начато | нет | нет | P1 contracts; D2/D6/D14, D3 для real materials |
| P3 | не начато | нет | нет | P1 user/session; D7–10/D15 и настройки providers |
| P4 | не начато | нет | нет | P1/P2/P3, D11/D12 feature manifest до первого event |
| P5 | не начато | нет | нет | Durable inputs P4; D12/D13/D14; snapshot retention D4 |
| P6 | не начато | нет | нет | Реализация+static P1–P5, принятые D, actual runtime authorization и isolated targets |

Для каждой выполненной задачи добавлять дату, точный изменённый scope, output contract, команды/exit codes либо observed evidence, ограничения/remaining dependencies. После этапа обновлять этот документ и затронутые существующие docs/agents темы, если production изменил уже описанный контракт: apps/api/AGENTS.md; apps/api/docs/agents/index.md, data-access.md, security.md, runtime.md, jobs-and-mail.md, storage.md по фактическому влиянию. Это будущие scoped правки соответствующего implementation prompt, сейчас их не делать. Не создавать missing старые specs ради заполнения ссылок.

Ни один этап не запускает следующий автоматически. Обсуждение плана и D завершается согласованными статусами в mvpDesign; отдельный prompt реализации запускает только выбранный этап. Runtime — отдельный чат P6. Нет обязательных tests/Storybook/коммитов/worktree или автоматического deploy.

### Отчёт P1 — 8 октября 2026 года

Согласование: после явного предупреждения о статусе предложения и списка из четырёх пунктов владелец ответил «делай». Приняты только physical-контракты задач P1.1–P1.6 и нужные persistence-части D; алгоритмы/HTTP/CLI следующих этапов не реализованы и не объявлены согласованными целиком. Маршрут: Amy Mongoose entity, Nest module и document-agent-context; Superpowers подготовка/исполнение плана, systematic-debugging для ошибок статических проверок и verification-before-completion. Без tests/Storybook, подагентов, workflow artifacts, staging и commits.

Результат:

- P1.1: shared Item/Movie ObjectId, ItemId остаётся {type,id}; TCreateItem/TCreateMovie требуют заранее назначенный _id, Movie._id не генерируется автоматически и ссылается на Item. Locale-значения, оригинальные названия/aliases, Origin/evidence/derived inputs, StorageRef и SnapshotRef. MongoTransactionService.run(callback, options?) сохраняет прежних callers и тип options из установленного ClientSession.withTransaction.
- P1.2: locale-массивы всех прежних потребителей LanguageText, stable dictionary keys, revision/definitionOrigin, применимость/transfer policy; Feature constraints, origin/revision привязок и relation tupleKey. Primitive valueType проверяется схемой ItemFeature; соответствие конкретному Feature/единице/revision — сервис P2.
- P1.3: SourceItem с nullable item, namespace, binding/suppression decisions и revision. SourceArtifact.ref={backend:s3,bucket,key}, hash/size; ProcessingRun и приватный AI context; accepted CatalogDecision/assigned IDs/revisions/sequence; SearchIndexState pointer/checkpoints/lease. Старые source_external_item/item_source заменены декларациями source_external_identity/item_source_lookup.
- P1.4: обычный User с accessCodeHash/credentialVersion/actionSequence/permissions, Google+Яндекс, rolling Session fields/rotation receipt. EUserType удалён после поиска production-потребителей; passwordHash сохранён как неактивное прежнее поле. OAuthAttempt, CredentialOperationReceipt, RecoveryChallenge/durable delivery ref, AccountAccessEvent. Raw credentials не добавлены; encrypted fields select:false и удаляются toJSON. HTTP/OAuth/crypto/mail behavior отсутствует до P3.
- P1.6: bounded snapshot chunks/code manifests/source basis/owner-service visibility, RecommendationRequest ranking metadata, projection generations/CAS fields, до трёх taste centres и раздельные s/c/M/u/v/t/w/b. ItemMetric unique(generation,item.type,item.id), cutoff и unresolved snapshot refs. Параметры/формулы не вычисляются.
- P1.5: minute-only attempts с UUID, safe integer nullable progress, sequences и lineage; rating integer1..10; прямые/скопированные поля и alternatives, tombstone attempt IDs; nullable shown dates. UserAction kind/payload union и schema validator exact payload keys, receipt/before-after/frozen feature basis; RecommendationExposure и один actionEventId=exposureId. UserAction.minimize=false сохраняет пустые payload команд. Межколлекционные owner/sequence/identity проверки и semantic transitions — P4.
- Все 15 новых root entities имеют собственные repositories и modules; AppModule содержит 32 entity modules. Композиция существующих MongoRead/Write/Pagination/Bulk/AggregationRepository сохранена; session передаётся в options, transactions принадлежат будущему application-service. Ни generic CRUD facade, ни endpoints не добавлены.

Статический inventory: **32 root schemas, 44 child schemas, 562 объявленных поля, 53 named indexes (34 unique, 19 nonunique)**; имена индексов не повторяются. Это source count, не число созданных MongoDB коллекций/индексов. Child schemas без _id/id/timestamps/versionKey; root strict/timestamps/versionKey:false и текущие global plugins сохранены. Артефакты, snapshots, decisions/actions/exposures имеют immutable paths; low-level repository APIs и администратор БД не заменяются обещанием WORM. Append-only application behavior — будущие сервисы.

Выполненные команды из apps/api (exit 0 в финальном состоянии):

- node node_modules/typescript/bin/tsc --noEmit;
- node node_modules/eslint/bin/eslint.js <точный список изменённых production .ts>;
- node node_modules/prettier/bin/prettier.cjs --check <точный список изменённых production .ts>; адресный --write только этих файлов. Документы проверены по изменённым контрактам, ссылкам и diff; существующие разделы не форматируются массово;
- node node_modules/@nestjs/cli/bin/nest.js build (Rspack 2.2.6);
- статический AST inventory production schema declarations, refs/module source review, проверка локальных Markdown links и git diff --check.

Tooling: pnpm run type-check первоначально остановился до tsc с ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR при внутреннем package-manager bootstrap. Зависимости не переустанавливались и package/lockfile не менялись; проверки выполнены прямыми локальными CLI тех же установленных пакетов. Установленный Mongoose 9.10.1 подтверждён чтением package manifest и исходника default(undefined); options типизирован через фактический ClientSession, без выдуманного экспорта TransactionOptions.

Ограничения: Nest application context, HTTP/CLI/worker, model validation runtime и подключения Mongo/Redis/S3/search/providers/mail не запускались. autoIndex:true остаётся текущим поведением DatabaseModule: нельзя запускать новые модели против существующей БД без отдельного согласованного rollout. Миграции, syncIndexes/drop/create индексов и операции с данными не выполнялись. SourceArtifact/Snapshot refs и encrypted metadata не доказывают сохранность bytes, crypto или replay; refs, публикация revision, semantic lineage/CAS и counter correctness проверяются сервисами P2–P5 и изолированной приёмкой P6. Конечные caps: 1024 snapshot chunks, 50 request ranking/results, восемь structured reasons на result, 256 inline evidence keys/refs, 4096 preferences на центр/negative list/прежнее tagPreferences и максимум три центра; большие evidence хранятся в snapshot refs, без автоматического усечения.

**Требуется P2:** отдельный запуск CLI/operator bootstrap, validation/staging/reconciliation/публикация, matching и обратимый identity mapping, gates происхождения/type/unit/revision и доставка в поиск. Persistence prerequisite P1 теперь есть; нужны решения D2/D6/D14 для поведения и D3 для реальных материалов. P2 автоматически не запущен.

## 10. Отложенный объём

Другие Item types и настоящий cross-media перенос; work/release/edition; актёры/персонажи как Items, франшизы/публичные collections; user submissions/moderation/complaints/social/friends/comments/notifications; detailed adult settings и публичный запуск до отдельной политики; trailer/player/links where-to-watch; monetization/game achievements; public/plugin API и dynamic adapters; automatic scraping/cron ingestion/AI API; mandatory embeddings/ML/LLM explanations; simulation/A-B platform и доказательство real-user uplift; frontend UX (кроме manual browser provider acceptance); password/email OTP login/temporary conversion/support bypass/backup key; автоматические destructive migrations/cleanup/TTL неподтверждённого scope.

Не откладываются обязательные обычные account/provider/recovery contracts, agreed movie filters, event replay inputs, два engine implementations и минимальная failure recovery. Недоступные credentials/materials помечаются конкретным blocker приёмки, не исчезают из DoD.

## 11. Проверка полноты этого плана

- Все 11 DoD сопоставлены tasks и наблюдаемым P6 результатам; stale DoD5 явно заменён без правки vision.
- First-fill зависит от CLI operator/bootstrap, не от будущего P3; словари прежде movies, Relation после endpoints.
- P4 frozen basis предшествует первому taste signal; request producer P5 завершает зависимость exposure receiver P4 без fake shown.
- Idempotency namespaces, declared unique indexes, revisions/fences, receipts и delivery tail имеют владельцев; поиск и jobs не authority данных.
- Snapshots содержат bytes/chunks/versions/code, metadata не replay; retention не подменён сроком90д или вечным хранением.
- Все новые/изменяемые пути ниже apps/api либо разрешённые документы; новые пути — proposal, не утверждение существования. Дополнительных workflow artifacts сейчас не создаётся.
- Непринятые D перечислены с зависимостями; принятие startup parameters не утверждает algorithm/API/schema proposals.

Маршрут подготовки: Amy route-project-changes + shared workflow для продуктовых документов; Superpowers brainstorming/writing-plans/verification-before-completion в пределах запроса. Production coding skills применяются только при соответствующих будущих этапах, тестовые/TDD шаги исключены пользовательскими правилами.

### Фактическая проверка подготовки плана — 8 октября 2026 года

В этом чате выполнены source/config/lockfile inspection, сверка 32 уникальных task IDs и ссылок, наличия всех восьми обязательных task-полей, матрицы11 DoD, Markdown fences/отсутствия trailing whitespace и git diff --check (exit0). Сравнение хешей прочитанных apps/api production/config файлов не обнаружило изменений; vision/prompts побайтово сохранены. Git staging не менялся.

Type-check, lint, build, formatter и runtime не запускались: production не менялся, план проверен структурно; локальные прямые dependency manifests недоступны. Тесты/Storybook проверены только по существованию путей: в apps/api соответствующих файлов не найдено, web stories вне scope не читались. Mongo/Redis/S3/search/OAuth/mail не подключались. Статический review документа не повышает статусы реализации P1–P6.
