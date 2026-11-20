# Просмотр коллекции: покрытие API

[Индекс покрытия](readme.md) · [Требования страницы](../../product/pages/collection.md) · [Контракт коллекций](../contracts/collectionsSpec.md)

## Реализовано

| Маршрут                        | Покрытие                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `GET /collections/:id`         | Метаданные, блоки, число доступных произведений, средняя оценка и счётчики оценок и избранного   |
| `QUERY /collections/:id/items` | Курсорная подгрузка Item с поиском, диапазоном общей оценки, сортировкой и режимами grouped/flat |
| `GET /collections/:id/user`    | Своя оценка, избранное и скрытие, число завершённых Item из всего доступного состава             |
| `PATCH /collections/:id/user`  | Изменение своей реакции                                                                          |
| `PUT /collections/:id/poster`  | Загрузка обложки автором                                                                         |
| `DELETE /collections/:id`      | Мягкое удаление автором; операция редактора также доступна отсюда                                |

Код: [CollectionReadController](../../../../src/endpoints/collection/controllers/collectionReadController/core/collectionRead.controller.ts), [CollectionContentService](../../../../src/endpoints/collection/services/collectionContentService/core/collectionContent.service.ts), [CollectionService](../../../../src/endpoints/collection/services/collectionService/core/collection.service.ts), [CollectionUserService](../../../../src/endpoints/collection/services/collectionUserService/core/collectionUser.service.ts).

Публичное чтение состава возвращает карточки Item с заметкой включения и общей оценкой. При действующей сессии карточки содержат личную оценку, библиотечный статус и краткий прогресс последней попытки, если он задан. Свою запись с заметкой и попытками можно прочитать через [GET /items/:id/user](../requestFlows/catalog.md#item-user).

По умолчанию состав возвращается группами в авторском порядке. ID группы позволяет склеить её порции. Для подгрузки передаётся `nextCursor` предыдущего ответа. При изменении версии подборки или условий выдачи чтение начинают заново. Скрытие подборки сохраняет возможность прямого открытия страницы.

## Дальнейшая работа

[Задачи и вопросы](../../todos/pages/collectionPages.md#collection)

В ответе на детальный запрос `author=null` бывает у подборок сайта и при отсутствии записи автора. Административные операции выходят за рамки страницы.

## Результаты проверок

25 октября 2026 года для предыдущего контракта локально прошли 38 unit- и 126 HTTP-интеграционных тестов подборок на одноразовых MongoDB 8.0.17 и Redis 8.2.3. Текущие расширения контракта этими результатами не покрыты.
