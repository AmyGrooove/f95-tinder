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

Публичное чтение состава возвращает Item, данные включения, общую оценку и личные поля зрителя. При наличии cookie сервер проверяет сессию. Поиск полной личной записи по ID Item относится к LIB-01.

Состав возвращается в сохранённом порядке. Для подгрузки передаётся nextCursor предыдущего ответа; при изменении версии подборки чтение начинают заново. Доступны только cursor и limit: фильтры и режим grouped/flat из требований страницы пока не реализованы.

## Дальнейшая работа

[Задачи и вопросы](../../todos/pages/collectionPages.md#collection)

В ответе на детальный запрос `author=null` бывает у подборок сайта и при отсутствии записи автора. Административные операции выходят за рамки страницы.

## Результаты проверок

Историческая проверка предыдущего контракта. 25 октября 2026 года локально прошли 38 unit- и 126 HTTP-интеграционных тестов подборок на одноразовых MongoDB 8.0.17 и Redis 8.2.3. Для чтения состава проверены публичный ответ без UserItem, игнорирование cookie, отказ от удалённых личных фильтров, диапазон сохранённой общей оценки и пагинация после фильтрации. Это не проверка рабочего API или БД; статистика самой подборки и полный личный прогресс остаются нереализованными. Расчёт ItemStats при изменениях UserItem уже есть, но данный ответ этих метрик не содержит.
