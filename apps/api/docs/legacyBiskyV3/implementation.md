# Реализация старого Bisky: проверенные срезы кода

[Навигатор архива](readme.md) · [Сценарии](pagesAndFlows.md) · [Архивный Swagger](screenApiMap.md) · [Применение к новому Bisky](newBiskyReferenceApplication.md)

Статическая сверка 24 октября 2026 года. Код подтверждает наличие реализации, но не её развёртывание, работу на реальных данных или соответствие конкретному экспорту Figma. Сетевых трасс и записей интерактивного прохождения в этом архиве нет. Наблюдения на PNG, прежние сведения Figma, архивный список Swagger и исходники остаются отдельными источниками.

## Какие версии проверены

Использованы локально доступные Git-объекты соседних репозиториев `bisky-back` и `bisky-front`, без обновления из сети. Имена веток ниже относятся к этим локальным ссылкам, а не к подтверждённому состоянию GitHub или production.

| Репозиторий и ссылка      | Коммит                                     | Назначение                                                                               |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `bisky-back origin/main`  | `208d32f2352b5f8addb4c97650491f2b8a3f70de` | Legacy NestJS/Mongoose: `src/modules/base`, `src/modules/endpoints`, `src/modules/crons` |
| `bisky-front origin/main` | `a8ccb1af98568bd97a7abd5d6e76acdc31b9d8c1` | Next.js App Router, `src/entities`, `src/routes`, общие UI и API-клиент                  |
| `bisky-back origin/dev`   | `2648e01cc90ee4462979a4da53f1cb30820b1933` | Другой срез с `src/entities` и новой структурой схем; не источник контрактов legacy main |
| `bisky-front origin/dev`  | `5a85e5d392e943c78167ead806f79436075f686a` | Отдельная ветка; её поведение здесь не объединяется с main                               |
| `bisky-front origin/temp` | `3ebda776050bd9fdb1d6c0a246cc0856bdfd808e` | Дополнительная ветка; само имя не доказывает её возраст или экспериментальный статус     |

Локальные `main` отличаются от `origin/main`. Для воспроизведения сведений нужно читать указанный коммит, например `git show <commit>:src/modules/endpoints/home/services/home.service.ts` в backend-репозитории. Файлы соседних репозиториев не входят в этот архив.

Сравнение локальных ссылок через `git rev-list --left-right --count origin/main...origin/dev`: backend — `0 / 27`, frontend — `183 / 83`; frontend `origin/main...origin/temp` — `0 / 1`. Это числа коммитов только слева/только справа, не номера версий. Доступные срезы не подтверждают сведения об отдельной SQL-модели с триггерами или Redux/Chakra-архитектуре temp. Привязка таких сведений к другим историческим коммитам не установлена; использовать их для описания этих ревизий нельзя.

## Данные и границы backend

Центральная карточка в проверенном legacy backend — `Anime`, а не SQL `Title`. Схемы лежат в `src/modules/base/<entity>/schemas`, HTTP-операции — в `src/modules/endpoints`, фоновые сбор, обновление и генерация ленты — в `src/modules/crons`.

| Понятие               | Представление в коде                                        | Значимые границы                                                                                                                                              |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Произведение          | `anime/schemas/anime.schema.ts`                             | `name`, `otherNames`, `poster`, `kind`, статус выпуска, возрастной `rating`, описание, кадры, `related`, даты и сведения о сериях; `slug` объявлен уникальным |
| Личная запись         | `userAnimeReaction/schemas/userAnimeReaction.schema.ts`     | `author` + `animeID`, `status`, `score`, `isFavorite`, `reWatchedCount`; уникальный индекс пары пользователь/аниме                                            |
| Статус списка         | `userAnimeReaction/schemas/listStatus.entity.ts`            | `added`, `watching`, `completed`, `dropped`; это не статус выпуска Anime                                                                                      |
| Прогресс эпизода      | `userEpisodeProgress/schemas/userEpisodeProgress.schema.ts` | `author` + `animeEpisodeID`, `lastWatchedDuration`, `isWatched`, `reWatchedCount`, `firstWatchedAt`; уникальный индекс пары пользователь/эпизод               |
| Коллекция             | `collection/schemas/collection.schema.ts`                   | Название, описание, `author`, `isPublic`, `type`, `slug`, теги; автор может отсутствовать                                                                     |
| Состав коллекции      | `collectionItem/schemas/collectionItem.schema.ts`           | `collectionID` + `animeID`, `order`; уникальный индекс пары коллекция/аниме                                                                                   |
| Временный пропуск     | `skippedAnime/schemas/skippedAnime.schema.ts`               | Персональная пара `author` + `animeID`; TTL по `createdAt` задаётся `TIMER.SKIPPED_ANIME_EXPIRATION`                                                          |
| Запрет по внешнему ID | `bannedAnime/schemas/bannedAnime.schema.ts`                 | Уникальный `shikimoriID`, без владельца; отдельная административная операция                                                                                  |

`rating` у Anime означает возрастную категорию; пользовательская оценка хранится в `UserAnimeReaction.score`. В `HomeService` средний балл вычисляется MongoDB-агрегацией `$avg` по реакциям, для топа также учитывается число ненулевых оценок. Это не подтверждает SQL-триггеры и не определяет все рейтинги старого приложения.

Схема прогресса содержит позицию просмотра, но `PatchEpisodeProgressBodyDto` выбирает только `reWatchedCount`, `firstWatchedAt`, `isWatched`. Наличие поля в БД не доказывает его запись через этот PATCH или автоматическое сохранение позиции плеера.

## API, сценарии и потребители

Пути указаны по контроллерам проверенного backend; базовый URL задаётся отдельно клиентом. Это выборочная карта подтверждённых операций, а не замена всем 100 записям архивного Swagger.

| Сценарий                 | Реализация HTTP                                                                                                                                             | Контракт и frontend-потребитель                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Начальная главная        | `GET /home`, `HomeController` → `HomeService.getInitialHomeData`                                                                                            | Возвращает `seasonalAnimes`, `newEpisodeAnimes`, `bestAnimes`; клиент `entities/home/api/getInitialHomeData`, страница `routes/main/MainPage`                                                            |
| Догрузка главной         | `GET /home/row`, `HomeService.getHomeRow`                                                                                                                   | `elementIndex`: целое 1–100; ответ `isEnd` + `result` с типом `official`, `genre`, `fact` или `tip`. `useInfiniteGetHomeRow` увеличивает индекс до `isEnd`                                               |
| Поиск                    | `GET /search`, `SearchController` → `SearchService`                                                                                                         | Строка `search`, необязательный `searchType`: `Anime`, `Collection`, `DubClub`, `User`. Клиент `entities/search/api/getSearch`                                                                           |
| Карточка                 | `AnimeController`: `GET /anime/:ID`, `/:ID/additional`, `/:ID/mini`, `/:slug/meta`                                                                          | Клиенты `entities/anime/api/getAnimeMainInfo`, `getAnimeAdditionalInfo`, `getAnimeMiniInfo`, `getAnimeMeta`; разделение представлений не требует повторения в новом API                                  |
| Личные реакции           | `AnimeUserController`: `GET /anime/:ID/userAnimeReactions`, `POST /anime/:ID/favorite`, `/score`, `/userStatus`, `PATCH` и `DELETE /anime/:ID/userReaction` | Защищены `AccessTokenGuard`; клиенты `entities/anime/api/getUserCurrentAnimeReactions`, `setAnimeFavorite`, `setAnimeScore`, `setAnimeUserStatus`, `setAnimeUserReactionData`, `deleteAnimeUserReaction` |
| Эпизоды и плееры         | `AnimePlayerController`: `GET /anime/:ID/episodes`, `GET /anime/episode/:ID`                                                                                | Разные ID произведения и эпизода; клиенты `getAnimeEpisodes`, `getAnimeEpisodePlayers`                                                                                                                   |
| Личный прогресс эпизодов | `AnimeEpisodesUserController`: `GET /anime/:ID/userEpisodes`, `PATCH /anime/episode/:ID`                                                                    | `AccessTokenGuard`; клиенты `getUserEpisodesData`, `patchEpisodeProgress`; ограничения полей PATCH описаны выше                                                                                          |
| Обновление токенов       | `AuthSessionController`: `PATCH /auth/session/refresh`                                                                                                      | `RefreshTokenGuard`; клиент `shared/utils/functions/apiFetch/core/refreshToken/refreshToken.ts`                                                                                                          |
| Удаление сессии          | `DELETE /auth/session/delete`                                                                                                                               | `RefreshTokenGuard`; `DeleteSessionBodyDto` передаёт `refreshToken` в теле, а не ID в пути                                                                                                               |

`GET /home` формирует до 10 сезонных карточек, до 20 карточек с новыми сериями и до 20 лучших. Надпись «Топ-100» на странице не означает 100 элементов в начальном ответе. `/home/row` читает подготовленную ленту из кеша; отсутствие ленты или элемента обрабатывается как 404. В проверенном `HomeController` есть только `/home` и `/home/row`: архивные `/home/collections` и `/home/user/watch` этим контроллером не подтверждены.

Поиск использует Meilisearch для получения ID и порядка результатов, затем MongoDB для данных карточек. Без `searchType` возвращает четыре массива `animes`, `collections`, `dubClubs`, `users`; при полном отсутствии результатов выбрасывает 404. `DubPerson`, параметры страниц, сортировки и аниме-фильтров в `GetSearchQueryDto` отсутствуют. Поэтому все блоки и фильтры поискового макета нельзя объявлять реализованными этим endpoint.

Исходники: backend `src/modules/endpoints/{home,search,anime,auth}/{controllers,services,dto}`, frontend `src/entities/{home,search,anime}/api`. Архивный `GET /anime/userReactions` отличается от подтверждённого кодом `GET /anime/:ID/userAnimeReactions`; исходный список сохранён без исправления задним числом.

## Frontend и состояние

Проверенный frontend использует Next.js App Router: `src/app/(main)/page.tsx` экспортирует `MainPage` из `src/routes/main/MainPage`. Страница получает начальные данные на сервере через `useMainPage`, выводит сезонную карусель, новые серии, топ и `InfiniteHomeRow`. Отдельный блок «Продолжить просмотр» в этой композиции не найден; PNG показывает проектный вариант, а не доказательство его наличия в данном коммите.

API-функции и Query hooks находятся в `src/entities/<area>/api`, представления — в `src/routes`, общий интерфейс — в `src/shared/ui` и `src/widgets`. `RootLayout/core/Providers/core/useProviders.tsx` создаёт TanStack QueryClient. `useInfiniteGetHomeRow` хранит страницы выдачи, использует `elementIndex` и `isEnd`; само наличие hook не доказывает прохождение всего сценария в браузере.

`authorizedFetch` читает токены через `indexAuthDB`, на клиенте добавляет Bearer-заголовок и отправляет `credentials: 'include'`. При 401 для access token пытается обновить токены, сохраняет их и повторяет запрос. Backend `AccessTokenStrategy` читает cookie `accessToken`, затем Bearer; его `validate` возвращает ID из payload. Это историческая схема, отличная от нынешних `__Host-*` cookie и проверки серверной сессии нового API.

`useIsMobileServer` читает cookie `isMobile === '1'`; `useMainPage` выбирает вариант `small`/`big`. Это подтверждает серверное переключение варианта главной, но не конкретную ширину CSS breakpoint и не устройство адаптивности всех страниц.

## Сбор данных, пропуски и административные операции

`AnimeParsingController` предоставляет `GET /animeParse/queue`, `POST /animeParse/parseAnimesByYear`, `POST /animeParse/updateNewAnime`; `MainFeedCronsController` — `GET /mainFeed/queue`, `POST /mainFeed`. Контроллеры требуют `AccessTokenGuard` и `AdminGuard`. Генерация ленты не является обязательным запросом при открытии страницы.

`POST /bannedAnime` также требует обе проверки, принимает `shikimoriIDs` и записывает глобальные внешние ID; `animeUpdate.service.ts` обращается к этому списку при обновлении данных. Это не персональное «Не предлагать» и не доказательство территориального запрета просмотра.

В `AniPickService` пропуск сохраняется через `SkippedAnimeService` для пользователя; его кандидаты исключают пропущенные им ID. В схеме указан TTL `3 * 30 * 24 * 60 * 60` секунд, то есть 90 дней. Это настройка индекса в коде, а не проверка наличия индекса или точного момента удаления записи в работающей MongoDB. Срок нового пропуска этим не определяется.

## Что переносимо в новый Bisky

Это сопоставление понятий с текущими документами и кодом, а не новый план реализации.

| Legacy                                     | Текущий Bisky                                  | Условие переноса                                                                                          |
| ------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Anime`, названия и постер                 | Единый `Item`, `title`, `aliases`, `media`     | Сейчас тип только `movie`; единая сущность карточки уже определена текущими основами и кодом              |
| `UserAnimeReaction`                        | `UserItem`                                     | Пять текущих статусов; независимые оценка, избранное и заметка; использовать действующий контракт         |
| `UserEpisodeProgress`, счётчик пересмотров | `UserItem.attempts`                            | Попытки с ID, статусом, датами и прогрессом в минутах; эпизодные поля не являются готовой миграцией       |
| `Collection` / `CollectionItem`            | Публичные ручные подборки с блоками и версиями | Уже имеют отдельный контракт; не считать приватными списками или разделами статусов                       |
| Главная, поиск и карточки                  | Будущие самостоятельные операции каталога      | Переносить пользовательскую задачу, а не маршруты или число запросов legacy                               |
| `SkippedAnime` / `BannedAnime`             | Состояния рекомендаций и ограничения каталога  | Сохранять раздельные смыслы; legacy TTL и административный запрет не задают новую персональную блокировку |
| Эпизоды, источники видео, плеер            | За пределами исходного MVP                     | Прогресс библиотеки не требует встроенного воспроизведения                                                |
| Сбор и обновление аниме                    | Сервисы источников и будущий импорт            | Следовать согласованиям, нормализации и сохранению ручных правок из текущих основ                         |

Текущая реализация сверена по `apps/api/src/app/app.module.ts`, схемам `Item`, `UserItem`, `ItemAttempt` и сервису `endpoints/userItem/services/userItem.service.ts`. Подробные действующие контракты: [обзор API](../api/readme.md), [библиотека](../api/librarySpec.md), [подборки](../api/collectionsSpec.md), [наполнение](../product/foundations/catalogWorkflow.md). Исследование не меняет эти контракты и не подтверждает runtime старого или нового приложения.
