# Подборки

[← Все эндпоинты](../endpoints.md) · [Контракт подборок](../contracts/collectionsSpec.md) · [Обозначения](readme.md)

Метаданные и статистика доступны публично. Чтение состава проверяет access cookie, если она передана, и может вернуть личные поля карточек. Создание, редактирование, удаление и личные реакции требуют access cookie: JWT → активная собственная UserSession + существующий User. Для изменения/удаления подборки проверяется также author. Все `:id` — ObjectId подборки. JSON — с `Content-Type: application/json`; неизвестные поля запрещены. Все ответы имеют `Cache-Control: no-store`. Общие ошибки: 400 — входные данные/ID, 401 — доступ защищённых операций, 403 — CSRF, 429 — throttling.

Эти восемь HTTP-потоков не публикуют событий и не ставят джоб. Загрузка обложки обращается к S3 и обрабатывает изображение; остальные операции работают с MongoDB. Включение Item в подборку не меняет UserItem и вкус пользователя. Отдельный обработчик изменений TagItem поддерживает автоматические подборки, но эти маршруты его **не вызывают**. Обновление поиска происходит [независимым фоном](catalog.md#search-sync).

<a id="get"></a>

## GET /collections/:id

Открыть метаданные, блоки и статистику подборки. **Пример:** `GET /collections/507f1f77bcf86cd799439011`, без тела. **Ответ:** 200, id/version/author/type/title/description/media/blocks/createdAt/updatedAt/itemCount/ratingAverage/ratingsCount/favoritesCount. Автор — {id, avatar, displayName} или null. Item внутри групп загружаются отдельно.

```mermaid
flowchart TD
    accTitle: Открытие подборки
    accDescr: Прочитать неудалённую Collection, публичные данные автора и статистику или вернуть 404
    A(["GET /collections/:id"]):::http --> B["Проверить формат ID"]:::action
    B --> C[("Прочитать неудалённую Collection")]:::data
    C -->|Найдена| U[("Прочитать автора, посчитать доступные Item и агрегировать реакции")]:::data
    C -->|Отсутствует| N(["404"]):::response
    U --> D(["200 — метаданные, блоки и статистика"]):::response
```

После чтения Collection сервис параллельно запрашивает публичные поля автора, число доступных Item и агрегаты UserCollection. Если запись автора отсутствует, author в ответе равен null. Отсутствующая и soft-deleted подборка дают одинаковый 404. Все операции выполняются без записи и общей транзакции.

**Технические подробности:** CollectionReadController.getById → CollectionService.getById/mapResponse → CollectionRepository.findNotDeletedById. [Контроллер](../../../../src/endpoints/collection/controllers/collectionReadController/core/collectionRead.controller.ts), [сервис](../../../../src/endpoints/collection/services/collectionService/core/collection.service.ts), [репозиторий](../../../../src/entities/collection/services/collectionRepository/core/collection.repository.ts), [response DTO](../../../../src/endpoints/collection/services/collectionService/dto/collection.response.ts).

<a id="items"></a>

## QUERY /collections/:id/items

Первый запрос передаёт `{}` или параметры чтения. Следующие передают `cursor` из `nextCursor`. Пример главной — `{"types":["movie","series"],"isPersonalFilteringEnabled":true,"isMetadataIncluded":true}`. Пример Баттла — `{"mode":"flat","isItemStatusFilteringEnabled":true}`. При наличии access-cookie сервер проверяет зрителя. См. [контракт выдачи Item](../contracts/collectionsSpec.md#выдача-item).

```mermaid
flowchart TD
    accTitle: Чтение состава подборки
    accDescr: Проверить запрос и при необходимости сессию, прочитать подборку и вернуть страницу видимых произведений либо сигнал о скрытии
    A(["QUERY /collections/:id/items"]):::http --> B["Проверить ID и тело"]:::action
    B --> C{"Передана access-cookie?"}:::decision
    C -->|Да| D["Проверить JWT, UserSession и User"]:::action
    C -->|Нет| E[("Прочитать Collection")]:::data
    D -->|Сессия действительна| E
    D -->|Сессия недействительна| U(["401"]):::response
    E --> F["Проверить область курсора"]:::action
    F --> G{"Учитывать скрытие подборки?"}:::decision
    G -->|Да| H[("Прочитать UserCollection")]:::data
    G -->|Нет| J[("Применить условия, отсортировать и прочитать страницу с оценками и личными полями")]:::data
    H --> I{"Подборка скрыта?"}:::decision
    I -->|Да| M(["200 — пустая страница, isHidden: true"]):::response
    I -->|Нет| J
    J --> K["Собрать блоки или плоский список, курсор и запрошенные метаданные"]:::action
    K --> L(["200 — страница состава, isHidden: false"]):::response
```

Скрытие подборки проверяется у вошедшего зрителя при `isPersonalFilteringEnabled: true`. Если включён любой из двух флагов, сервер исключает произведения со статусами зрителя `completed`, `dropped` и `blocked`. Эти исключения, поиск, ограничение типов и диапазон ItemStats применяются до пагинации. Для карточек вошедшего зрителя возвращается краткий прогресс последней попытки. Группы сохраняют свои ID между порциями. При фильтрации пустая страница без видимых Item не содержит текста. Недействительная cookie даёт 401, отсутствующая подборка — 404, несоответствие курсора — 400. Маршрут выполняет только чтение.

<a id="create"></a>

## POST /collections

Создать подборку от текущего пользователя. **Пример:** `POST /collections`, `{"title":{"ru":"Вечернее кино"},"type":"custom"}`, access cookie. **Ответ:** 201, объект {id}.

```mermaid
flowchart TD
    accTitle: Создание подборки
    accDescr: Проверить пользователя, название и структуру блоков, одной транзакцией проверить Item и создать Collection с ItemCollection, ответить после commit
    A(["POST /collections"]):::http --> B["Проверить доступ, название, блоки и ссылки на группы"]:::action
    subgraph TX["Транзакция MongoDB"]
        C[("Проверить неудалённые Item, если передан состав")]:::data
        C --> D[("Создать Collection с author = текущий User")]:::data
        D --> E[("Создать ItemCollection, если передан состав")]:::data
    end
    B --> C
    E -->|Commit| F(["201 — ID подборки"]):::http
```

Название должно быть заполнено хотя бы на одном языке. Проверяются уникальные ID блоков/Item, корректность group/text и принадлежность каждого item.groupId итоговой группе. Нет добавляемого Item или он удалён — 404; структура/дубли/пустое название — 400. Collection и весь состав создаются/откатываются вместе; при пустом составе Item/ItemCollection не затрагиваются. После commit выполняется только отображение ответа, enqueue/events нет. Потерянный ответ не откатывает создание.

**Технические подробности:** [CollectionController.create](../../../../src/endpoints/collection/controllers/collectionController/core/collection.controller.ts) → [CollectionService.create/prepareBlock](../../../../src/endpoints/collection/services/collectionService/core/collection.service.ts) → CollectionAuthService.authenticate → MongoTransactionService.run → ItemRepository.findNotDeletedByIds, CollectionRepository.write.create, ItemCollectionRepository.createForCollection. [DTO](../../../../src/endpoints/collection/services/collectionService/dto/createCollection.body.ts).

<a id="update"></a>

## PATCH /collections/:id

Изменить собственную подборку и её состав с проверкой версии. Поля blocks и items группируют операции add, update, move и remove. **Пример:** `PATCH /collections/507f1f77bcf86cd799439011`, `{"version":0,"title":{"ru":"Кино на выходные"}}`, access cookie. **Ответ:** 204 без тела. Версия увеличивается при сохранении.

```mermaid
flowchart TD
    accTitle: Редактирование собственной подборки
    accDescr: Проверить доступ, внутри транзакции проверить автора и версию, итоговые блоки и состав, сохранить Collection и ItemCollection и ответить после commit
    A(["PATCH /collections/:id + version"]):::http --> B["Проверить доступ и непустое изменение"]:::action
    subgraph TX["Транзакция MongoDB"]
        C[("Прочитать Collection; проверить автора и version")]:::data
        C --> D["Проверить итоговые блоки, группы и Item"]:::action
        D --> E[("Условно обновить Collection и увеличить version")]:::data
        E --> F[("Добавить, переместить или удалить ItemCollection")]:::data
    end
    B --> C
    F -->|Commit| G(["204 — без тела"]):::http
```

Чужая, принадлежащая сайту (author=null), отсутствующая или удалённая Collection — одинаковый 404. Устаревшая версия или предел Number.MAX_SAFE_INTEGER — 409. Проверяются итоговый порядок блоков, уникальность, отсутствие конфликтующих добавлений/удалений, доступные группы, наличие удаляемых memberships и неудалённые добавляемые Item. Невалидная структура/пустое изменение — 400; нет Item — 404. Удаление группы удаляет связанные ItemCollection, кроме перенесённых в сохранённые группы. Все чтения/записи состава и условная запись версии используют одну session; сбой откатывает их вместе. HTTP ждёт commit, очередей и postcommit-вызовов нет.

**Технические подробности:** CollectionController.update → CollectionService.update/prepareUpdatedBlocks → [CollectionRepository.updateVersioned](../../../../src/entities/collection/services/collectionRepository/core/collection.repository.ts), [ItemCollectionRepository.findByCollectionAndItems/upsertForCollection/removeForCollection](../../../../src/entities/itemCollection/services/itemCollectionRepository/core/itemCollection.repository.ts), ItemRepository.findNotDeletedByIds. [Сервис](../../../../src/endpoints/collection/services/collectionService/core/collection.service.ts), [DTO](../../../../src/endpoints/collection/services/collectionService/dto/updateCollection.body.ts).

<a id="remove"></a>

## DELETE /collections/:id

Скрыть собственную подборку через soft delete. **Пример:** `DELETE /collections/507f1f77bcf86cd799439011`, без тела, access cookie. **Ответ:** 204 без тела.

```mermaid
flowchart TD
    accTitle: Удаление собственной подборки
    accDescr: Проверить доступ, атомарно выставить deletedAt только собственной неудалённой Collection и дождаться сохранения
    A(["DELETE /collections/:id"]):::http --> B["Проверить доступ и ID"]:::action
    B --> C[("Условно поставить deletedAt — своя Collection")]:::data
    C --> D(["204 — подборка скрыта; если нет — 404"]):::http
```

Один atomic update без отдельной MongoDB-транзакции, без version в запросе. Чужая, автоматическая, уже удалённая или отсутствующая подборка — 404. ItemCollection/UserCollection физически остаются; каскадной очистки нет, публичные чтения проверяют deletedAt. HTTP ждёт update, ошибка доставки ответа не отменяет soft delete. Фоновые удаления не запускаются.

**Технические подробности:** CollectionController.remove → CollectionService.remove → CollectionRepository.softDeleteByAuthor (id+author+deletedAt=null). [Контроллер](../../../../src/endpoints/collection/controllers/collectionController/core/collection.controller.ts), [сервис](../../../../src/endpoints/collection/services/collectionService/core/collection.service.ts), [репозиторий](../../../../src/entities/collection/services/collectionRepository/core/collection.repository.ts).

<a id="user"></a>

## GET /collections/:id/user

Прочитать свою реакцию и прогресс по всему составу. **Пример:** `GET /collections/507f1f77bcf86cd799439011/user`, без тела, access cookie. **Ответ:** 200, например `{"isFavorite":false,"rating":null,"isHidden":false,"progress":{"completed":2,"total":5}}`.

```mermaid
flowchart TD
    accTitle: Личная реакция и прогресс по подборке
    accDescr: Проверить пользователя, прочитать его реакцию и посчитать завершённые произведения среди всех доступных
    A(["GET /collections/:id/user"]):::http --> B["Проверить доступ"]:::action
    B --> C[("Проверить неудалённую Collection")]:::data
    C -->|Найдена| D[("Прочитать UserCollection и посчитать доступные и завершённые Item")]:::data
    C -->|Отсутствует| N(["404"]):::response
    D --> E(["200 — реакция и прогресс"]):::response
```

Без UserCollection поля реакции принимают значения false/null/false. Прогресс считается по всему доступному составу, независимо от реакции, фильтров и пагинации. Общей транзакции нет.

**Технические подробности:** [CollectionUserController.getUser](../../../../src/endpoints/collection/controllers/collectionUserController/core/collectionUser.controller.ts) → [CollectionUserService.getUser](../../../../src/endpoints/collection/services/collectionUserService/core/collectionUser.service.ts) → CollectionRepository.findNotDeletedById, UserCollectionRepository.findByUserAndCollection и [ItemCollectionRepository.readAvailableCounts](../../../../src/entities/itemCollection/services/itemCollectionRepository/core/itemCollection.repository.ts).

<a id="reaction"></a>

## PATCH /collections/:id/user

Принимает одно или несколько полей isFavorite, rating, isHidden. Пропущенные поля сохраняются, rating: null снимает оценку. Пустое тело отклоняется с 400. Автор не может поставить своей подборке оценку. Успех — 204 без тела.

```mermaid
flowchart TD
    A["Проверить access и тело"] --> B["Проверить подборку и право оценки"]
    B --> C["Сохранить переданные поля реакции одной записью"]
    C --> D["204 · без тела"]
```

<a id="poster"></a>

## PUT /collections/:id/poster

Автор передаёт одно изображение в multipart-поле file. Сервер обрабатывает его в WebP и сохраняет по ключу collections/<id>/poster/<uuid>.webp. Успех — 204 без тела. POST /collections принимает JSON без media.

```mermaid
flowchart TD
    A["Проверить access и авторство"] --> B["Обработать изображение"]
    B --> C["Записать WebP в S3"]
    C --> D["Обновить ссылку на обложку с проверкой версии"]
    D --> E["204 · без тела"]
```
