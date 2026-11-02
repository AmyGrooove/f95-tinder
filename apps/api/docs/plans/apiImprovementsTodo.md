# TODO: общие улучшения API

Дата: 2 ноября 2026 года.

Согласованные изменения вне реализации рекомендаций. Общие изменения этапа 1 реализованы 3 ноября 2026 года; пользовательская проверка ещё не выполнена. Доменное применение IValueFilter остаётся для этапа 2.

## Пагинация

- [x] Унифицировать названия результатов в `apps/api/src/infrastructure/database/types`: `IPaginatedResult` → `IPagePaginationResult`, `IListResponse` → `ICursorPaginationResult`. Объединить интерфейсы в `IPaginationResult.ts`, обновить импорты и реализации интерфейсов.
- [x] Удалить `limit` из результата страничной пагинации, включая `createPaginatedResult` и DTO ответов. Сохранить `limit` во входных параметрах и внутреннем расчёте количества страниц.
- [x] Вынести общий `type TPageSize = 10 | 20 | 50` в отдельный файл `apps/api/src/infrastructure/database/types/TPageSize.ts`. Общий размер порции по умолчанию — 50.
- [x] В одном файле `apps/api/src/infrastructure/database/types/IPaginationInput.ts` разместить базовый интерфейс `IPagination` с `limit?: TPageSize` и наследующие его `IPagePagination` с `page?: number` и `ICursorPagination` с `cursor?: string`.
- [x] Перенести `apps/api/src/shared/functions/pagination/createPaginatedResult` в `apps/api/src/infrastructure/database/functions/createPaginatedResult` и `apps/api/src/shared/functions/pagination/normalizePagination` в `apps/api/src/infrastructure/database/functions/normalizePagination`, сохранив структуру объектов функций и публичные entrypoints. Обновить production-импорты и переиспользовать новые общие типы вместо дублирующего объявления входной пагинации.
- [x] Привести типы, нормализацию, runtime-валидацию DTO, значения по умолчанию и Swagger к размерам 10/20/50 и default 50. Проверенные текущие потребители: MongoPaginationRepository, CollectionService, CollectionContentService, RecommendationsService, DTO ответов коллекций и createCollectionDisplayBlocks; также адаптировать page/limit поиска к общей политике размеров. Общий размер страницы не распространять на внутренние batch sizes.

После переноса функций `TPageSize` может находиться в database без обратного импорта из shared в infrastructure. Общие типы не должны импортировать сущности или endpoint-код.

## Общие условия фильтрации

- [x] Создать отдельный `apps/api/src/infrastructure/database/types/IValueFilter.ts` с общим `interface IValueFilter<TValue>` и необязательными полями `allOf`, `anyOf`, `noneOf` типа `readonly TValue[]`.
- [x] Тип не должен зависеть от Item, Tag, UserItem или рекомендательного модуля. Доменный потребитель определяет значения и способ получения набора, к которому применяются условия.
- [ ] Использовать тип для утверждённых фильтров тегов и библиотеки рекомендаций. Доменное библиотечное значение `outside` определяется в рекомендательном контракте, а не в общем IValueFilter.
