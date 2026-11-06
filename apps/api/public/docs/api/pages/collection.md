# Просмотр коллекции: покрытие API

[Индекс покрытия](readme.md) · [Требования страницы](../../product/pages/collection.md) · [Контракт коллекций](../contracts/collectionsSpec.md)

## Реализовано

| Маршрут                        | Покрытие                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `GET /collections/:id`         | Метаданные, author, version, медиа, полная структура group/text без списков Item, даты |
| `QUERY /collections/:id/items` | Курсорная подгрузка Item в сохранённом порядке, группы и текстовые блоки               |
| `GET /collections/:id/user`    | Собственная оценка коллекции, избранное и скрытие                                      |
| `PATCH /collections/:id/user`  | Изменение своей реакции                                                                |
| `PUT /collections/:id/poster`  | Загрузка обложки автором                                                               |
| `DELETE /collections/:id`      | Мягкое удаление автором; операция редактора также доступна отсюда                      |

Код: [CollectionReadController](../../../../src/endpoints/collection/controllers/collectionReadController/core/collectionRead.controller.ts), [CollectionContentService](../../../../src/endpoints/collection/services/collectionContentService/core/collectionContent.service.ts), [CollectionService](../../../../src/endpoints/collection/services/collectionService/core/collection.service.ts), [CollectionUserService](../../../../src/endpoints/collection/services/collectionUserService/core/collectionUser.service.ts).

Чтение состава публичное: возвращает только Item и данные включения в подборку, без userItem. Cookie авторизации не проверяется. Краткий QUERY /userItems читает состояние по известным ID UserItem; для карточек состава, где доступны только ID Item, поиск личной записи по Item ещё нужен (LIB-01).

Состав возвращается в сохранённом порядке. Для подгрузки передаётся nextCursor предыдущего ответа.

## Дальнейшая работа

[Задачи и вопросы](../../todos/pages/collectionPages.md#collection)

В ответе на детальный запрос у подборок сайта `author=null`. Административные операции выходят за рамки страницы.

## Результаты проверок

Историческая проверка предыдущего контракта. 25 октября 2026 года локально прошли 38 unit- и 126 HTTP-интеграционных тестов подборок на одноразовых MongoDB 8.0.17 и Redis 8.2.3. Для чтения состава проверены публичный ответ без UserItem, игнорирование cookie, отказ от удалённых личных фильтров, диапазон сохранённой общей оценки и пагинация после фильтрации. Это не проверка рабочего API или БД; расчёт метрик и полный личный прогресс остаются нереализованными.
