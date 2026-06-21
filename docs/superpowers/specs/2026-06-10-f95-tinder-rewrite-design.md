# F95 Tinder Rewrite Design

## 1. Goal

Полностью переписать приложение как web-сервис для нескольких пользователей.
Backend владеет всей бизнес-логикой и данными, frontend отвечает за отображение,
пользовательские жесты и вызов API.

Существующая кодовая база не переносится архитектурно. Она используется только
как ориентир для сохранения полезного поведения и визуального направления.

## 2. Scope

### MVP

- создание случайного пользователя без логина и пароля;
- авторизация по бессрочному токену-ключу;
- просмотр и копирование токена в настройках;
- общий каталог игр F95;
- очередь из 20 игр, формируемая backend;
- порядок MVP-очереди: наиболее популярные необработанные игры;
- решения `bookmark`, `trash`, `played`;
- отмена последнего решения в течение 10 минут;
- списки закладок, мусора и пройденных игр;
- перенос игры между списками;
- удаление решения с возвратом игры в доступную очередь;
- открытие темы игры на F95;
- fullscreen-просмотр обложки и скриншотов;
- клавиатурное управление свайпером и галереей;
- первичный полный импорт каталога;
- ежедневная актуализация каталога;
- отображение прогресса импорта и обновления.

### Later

- персональная рекомендательная система;
- фильтры и пользовательские сортировки;
- простая пользовательская оценка игры по шкале 1–4; точная семантика значений
  будет определена при проектировании рекомендаций;
- расширенный dashboard;

### Not Included

- Electron;
- миграция данных из старого приложения;
- cookies F95;
- логин, пароль, email и восстановление аккаунта;
- persistent cache API-данных на frontend.

## 3. Repository

Используется `pnpm workspace` без Turborepo.

```text
apps/
  api/
  web/
packages/
  contracts/
  config/
```

- `apps/api` — NestJS backend.
- `apps/web` — React + Vite SPA.
- `packages/contracts` — общие API-типы, enum и схемы контрактов.
- `packages/config` — общие TypeScript и lint-конфигурации.

Приложения имеют независимые команды запуска и сборки, но используют один
lockfile и общие workspace-пакеты.

## 4. Backend Structure

```text
apps/api/src/
  app/
  endpoints/
    auth/
    catalog/
    swipe/
    lists/
  entities/
    user/
    game/
    tag/
    prefix/
    userGameState/
    syncState/
  infrastructure/
    config/
    database/
    cache/
    scheduler/
    security/
    health/
  integrations/
    f95/
  shared/
    decorators/
    functions/
    types/
    static/
```

- `endpoints` содержит HTTP-контроллеры, DTO и прикладные сервисы.
- `entities` содержит MongoDB-схемы, типы и репозитории.
- `infrastructure` содержит MongoDB, Redis, crypto, scheduler и health checks.
- `integrations/f95` содержит клиент `latest_data.php`, нормализацию и ошибки.
- `shared` содержит только действительно общие примитивы.

Контроллеры не содержат бизнес-логику. Работа с MongoDB выполняется только через
репозитории сущностей.

## 5. Frontend Structure

```text
apps/web/src/
  app/
    providers/
    router/
    styles/
  pages/
    auth/
    swipe/
    lists/
    settings/
  entities/
    game/
    userGameState/
    session/
  widgets/
    appHeader/
    swipeDeck/
    gameLists/
    imageViewer/
  shared/
    api/
    hooks/
    lib/
    static/
    types/
    ui/
```

Отдельного слоя `features` нет. Сценарии, используемые одной страницей или
виджетом, находятся рядом с владельцем. В `entities` остаются переиспользуемые
модели и представления сущностей.

TanStack Query управляет API-состоянием и кэшем в памяти. Persistence кэша в
`localStorage` или IndexedDB не используется. В `localStorage` хранится только
токен авторизации.

## 6. Authentication

Пользователь не имеет профиля, логина или пароля. При создании формируется
случайный пользователь и криптографически стойкий бессрочный токен.

MongoDB хранит:

- `tokenHash` — для поиска и проверки Bearer-токена;
- `tokenEncrypted` — для показа исходного токена в настройках;
- IV/auth tag и версию ключа, необходимые выбранной схеме шифрования.

Ключ шифрования существует только в конфигурации backend. Токен передаётся во
всех защищённых запросах через `Authorization: Bearer <token>`.

Frontend стартует с двух действий:

- создать пользователя;
- вставить существующий токен.

При `401` frontend очищает локальную сессию и переводит пользователя на страницу
авторизации.

## 7. API

Все маршруты доступны с префиксом `/api`.

```text
POST   /api/auth/createUser
GET    /api/auth/session
GET    /api/auth/token

GET    /api/swipe/queue
POST   /api/swipe/decisions
POST   /api/swipe/undo

GET    /api/lists/:status?cursor=...&limit=20
PATCH  /api/lists/games/:gameId
DELETE /api/lists/games/:gameId

GET    /api/catalog/sync/status
GET    /api/catalog/sync/events

GET    /api/health
```

### Auth

- `POST /auth/createUser` создаёт пользователя и возвращает токен.
- `GET /auth/session` проверяет Bearer-токен и возвращает минимальную сессию.
- `GET /auth/token` расшифровывает и возвращает токен текущего пользователя.

### Swipe

- `GET /swipe/queue` возвращает сформированный backend набор из 20 игр.
- `POST /swipe/decisions` принимает `gameId` и один из трёх статусов.
- `POST /swipe/undo` отменяет последнее доступное действие пользователя.

Frontend не управляет размером, сортировкой или курсором очереди. Это позволяет
заменить популярностный алгоритм персональными рекомендациями без изменения
публичного API.

### Lists

- `GET /lists/:status` возвращает список с cursor pagination.
- `PATCH /lists/games/:gameId` переносит игру в другой список.
- `DELETE /lists/games/:gameId` удаляет решение.

Cursor является непрозрачной строкой. Для списков он строится по `updatedAt` и
`_id`; frontend только возвращает полученный `nextCursor`.

### Catalog Sync

- `GET /catalog/sync/status` возвращает текущий снимок синхронизации.
- `GET /catalog/sync/events` открывает SSE-поток обновлений прогресса.

## 8. Data Model

### users

```text
_id
tokenHash
tokenEncrypted
tokenEncryptionIv
tokenEncryptionTag
tokenEncryptionKeyVersion
createdAt
updatedAt
```

Индекс: `tokenHash`, unique.

### games

```text
_id
f95ThreadId
title
creator
version
views
likes
rating
tagIds[]
prefixIds[]
coverUrl
screenshotUrls[]
publishedAt
sourceUpdatedAt
importedAt
createdAt
updatedAt
```

Индексы:

- `f95ThreadId`, unique;
- `views + _id`;
- `sourceUpdatedAt`;
- `tagIds`;
- `prefixIds`.

### tags

```text
_id
f95TagId
name
createdAt
updatedAt
```

Индекс: `f95TagId`, unique.

### prefixes

```text
_id
f95PrefixId
name
createdAt
updatedAt
```

Индекс: `f95PrefixId`, unique.

Игры хранят исходные числовые F95 ID тегов и префиксов. MongoDB ObjectId-ссылки
между играми и справочниками не используются.

### userGameStates

```text
_id
userId
gameId
status: bookmark | trash | played
createdAt
updatedAt
```

Каждое решение является отдельным документом.

Индексы:

- `userId + gameId`, unique;
- `userId + status + updatedAt + _id`.

Обновление `status` переносит игру между списками. Удаление документа возвращает
игру в доступную очередь.

### syncStates

```text
_id
source
phase
currentPage
totalPages
processedGames
checkpointPage
watermarkSourceTimestamp
startedAt
lastSuccessfulSyncAt
nextRetryAt
lastError
createdAt
updatedAt
```

Индекс: `source`, unique.

## 9. Redis

Redis является обязательной зависимостью.

```text
user:{userId}:pending-decisions
user:{userId}:undo
user:{userId}:queue
game-state:dirty-users
sync-lock:f95-latest
```

- pending decisions хранят последнее состояние игры до flush;
- undo хранит одно последнее действие с TTL 10 минут;
- очередь может кэшировать текущий backend-набор пользователя;
- dirty users отмечает пользователей с несохранёнными решениями;
- sync lock запрещает параллельные импорты.

При недоступности Redis backend считается нездоровым и не принимает изменения
пользовательских решений.

## 10. Decision Write-Behind

Решение сразу записывается в Redis и становится видимым для последующих чтений.
Раз в 60 секунд worker собирает pending decisions и выполняет идемпотентный
MongoDB `bulkWrite`.

Чтение очереди и списков объединяет устойчивое состояние MongoDB с pending
состоянием Redis.

Допускается потеря решений, которые не были сброшены в MongoDB перед полной
потерей Redis.

Undo восстанавливает предыдущий статус или отсутствие решения и создаёт новое
pending-изменение для следующего flush.

## 11. Queue

`GET /swipe/queue` возвращает 20 игр.

В MVP backend:

1. получает игры по убыванию популярности;
2. исключает состояния пользователя из MongoDB;
3. дополнительно исключает pending decisions из Redis;
4. возвращает полные данные карточек.

Повторный запрос до решений может вернуть тот же набор. После решений backend
исключает обработанные игры и дополняет очередь.

Алгоритм полностью скрыт за endpoint, чтобы позже заменить его персональными
рекомендациями.

## 12. Catalog Import

Источник: `latest_data.php` с сортировкой `date`.

### Initial Import

При пустом каталоге backend импортирует все доступные страницы.

После каждой страницы сохраняются:

- checkpoint;
- текущий прогресс;
- количество обработанных игр;
- известное общее число страниц.

Записи сохраняются через `bulkWrite` с upsert по `f95ThreadId`.

При ошибке:

1. синхронизация переходит в `retrying`;
2. используются задержки 1, 5, 15 и 30 минут;
3. после последней задержки повторения продолжаются каждые 30 минут;
4. после восстановления backend повторно сканирует страницы от начала до
   checkpoint, чтобы учесть появившиеся и изменившиеся игры;
5. затем импорт продолжается с сохранённой позиции.

Импорт завершается только после обработки последней страницы. После завершения
checkpoint очищается и сохраняется watermark.

Пока первый импорт не создал пригодный каталог, `/swipe/queue` возвращает
`503 catalog_not_ready`.

### Daily Sync

Cron запускается один раз в сутки и идёт от первой страницы по сортировке `date`.
Каждая полученная страница обрабатывается до проверки остановки.

Проход завершается после страницы, целиком достигшей watermark предыдущей
успешной синхронизации. Новые и изменённые игры сохраняются через upsert. Игры,
которые не встретились в ежедневном проходе, не удаляются.

## 13. Sync Progress

Status и SSE возвращают:

```text
phase:
  idle | initial-import | daily-sync | retrying | completed | failed
currentPage
totalPages
processedGames
progressPercent
nextRetryAt
error
```

Frontend сначала получает `/catalog/sync/status`, затем подписывается на SSE.
После обновления страницы текущее состояние восстанавливается с backend.

Для полного импорта показывается процент. Если total pages ещё неизвестен,
используется неопределённый progress bar и счётчик страниц.

## 14. Frontend Behavior

### Auth

- создание пользователя;
- вставка токена;
- проверка сессии;
- хранение токена в `localStorage`;
- просмотр и копирование токена;
- выход с удалением токена.

### Swipe

- карточки сохраняют общее визуальное направление старого приложения;
- swipe right — `bookmark`;
- swipe left — `trash`;
- swipe up — `played`;
- кнопки дублируют жесты;
- клавиатура дублирует основные действия;
- undo восстанавливает последнюю карточку и состояние;
- при остатке примерно пяти карточек запрашивается новая очередь;
- optimistic update откатывается при ошибке API.

### Lists

- отдельные представления `bookmark`, `trash`, `played`;
- cursor pagination;
- перенос между списками;
- удаление решения;
- открытие темы игры на F95.

### Images

- клик по обложке или скриншоту открывает fullscreen viewer;
- `Escape` закрывает viewer;
- стрелки влево и вправо переключают изображения;
- UI содержит кнопки предыдущего и следующего изображения.

### Cache

TanStack Query использует обычный кэш в памяти. API-кэш не сохраняется между
перезапусками браузера. После reload данные загружаются с backend.

## 15. Error Handling

- `401` завершает локальную сессию.
- `503 catalog_not_ready` показывает состояние и прогресс импорта.
- недоступный Redis блокирует операции изменения;
- ошибка optimistic swipe возвращает карточку;
- SSE переподключается и сверяется с status endpoint;
- F95 integration нормализует сетевые, форматные и rate-limit ошибки;
- sync state сохраняет последнюю ошибку и время следующей попытки.

## 16. Deployment

Используется Docker Compose:

```text
web
api
mongodb
redis
```

Production работает через единый origin:

```text
/       -> React SPA
/api/*  -> NestJS
```

Контейнер `web` использует Nginx для SPA и reverse proxy. Для SSE отключается
proxy buffering.

Swagger доступен только в development по `/api/docs`.

## 17. Testing Strategy

- backend unit tests для прикладных сервисов;
- integration tests для MongoDB и Redis;
- frontend unit tests для hooks и компонентов;
- E2E: создание пользователя, вход, очередь, свайп, список, перенос, удаление и
  undo;
- F95 import тестируется через mock HTTP responses;
- автоматические тесты не обращаются к реальному F95.

## 18. Success Criteria

- приложение работает в браузере без Electron;
- frontend не содержит расчёта очереди, синхронизации или persistence;
- данные пользователей изолированы Bearer-токеном;
- полный импорт восстанавливается после ошибок;
- ежедневный cron актуализирует каталог;
- прогресс доступен после reload;
- решение сразу видно через Redis и позднее сохраняется в MongoDB;
- сохранены свайпы, клавиатурное управление, ссылки F95 и fullscreen-галерея;
- архитектура допускает добавление рекомендаций без изменения API очереди.
