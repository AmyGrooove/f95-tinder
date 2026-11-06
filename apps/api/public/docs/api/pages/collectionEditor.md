# Редактор коллекции: покрытие API

[Индекс покрытия](readme.md) · [Требования страницы](../../product/pages/collectionEditor.md) · [Контракт коллекций](../contracts/collectionsSpec.md)

## Реализовано

| Маршрут                        | Покрытие                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `POST /collections`            | Создание своей публичной коллекции с названием, описанием, типом, блоками и включениями Item      |
| `PATCH /collections/:id`       | Атомарные изменения метаданных, блоков, включений, заметок, групп и порядка; обязательная version |
| `GET /collections/:id`         | Загрузка метаданных, version и полной структуры блоков                                            |
| `QUERY /collections/:id/items` | Постраничная загрузка состава с groupId, position и note включений                                |
| `PUT /collections/:id/poster`  | Загрузка обложки автором                                                                          |
| `DELETE /collections/:id`      | Мягкое удаление своей коллекции                                                                   |

Код: [CollectionController](../../../../src/endpoints/collection/controllers/collectionController/core/collection.controller.ts), [CollectionService](../../../../src/endpoints/collection/services/collectionService/core/collection.service.ts) и [CollectionContentService](../../../../src/endpoints/collection/services/collectionContentService/core/collectionContent.service.ts).

PATCH принимает blocks и items с массивами add, update, move и remove. Порядок задаётся через beforeBlockId и beforeItemId, а позиции рассчитывает сервер. Устаревшая version даёт 409. При удалении группы исчезают включения, оставшиеся в ней после перемещений. Состав и UserItem независимы.

## Дальнейшая работа

[Задачи и вопросы](../../todos/pages/collectionPages.md#collectionEditor)

Порядок локальных действий и предупреждение об уходе определяются клиентом. Сервер выполняет единый PATCH атомарно. Управление официальными коллекциями обычному автору не предоставляется.
