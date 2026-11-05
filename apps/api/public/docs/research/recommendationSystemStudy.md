# Рекомендательная система Bisky: исследование и техническая спецификация

Дата: 1 ноября 2026 года. Проверенный checkout: `dc829701ca0c630d2784117684e85a041c36922d`. Документ предлагает будущую реализацию; production-код в рамках исследования не менялся.

**Дополнение от 2 ноября 2026 года:** [ручные предпочтения по тегам — §13](#13-ручные-предпочтения-по-тегам-исследование-2-ноября-2026-года). Разделы 1–12 сохраняют исходное исследование и его измерения. Для текущей реализации приоритет имеет [утверждённый план](../plans/recommendationsImplementationPlan.md), включая единую модель всех типов, Redis-список и отказ от прежнего content-fallback. Предложения §13 ещё не утверждены и план не изменяют.

## 1. Основные выводы

Рекомендую **двухэтапную выдачу с ограниченным пулом, пакетным MongoDB-чтением и заменяемыми content/collaborative источниками**, с вычислениями модели в worker threads существующего Node API. Сохранить нынешний exact find отдельно: быстрый приблизительный feed не заменяет глобальную сортировку и точный total.

1. На реальных данных anime/Steam (по 3 splits) и VNDB нет одного безусловного алгоритма-победителя. ALS сильнее CF на anime; CF+ALS улучшает Steam; дополнительный anime CF+ALS run тоже лучше ALS. При этом genre-only content слаб, а rare/new-item CF recall практически нулевой. Content обязателен как возможность cold-start, но слабую жанровую модель не нужно насильно смешивать с сильным CF.
2. Нынешний production scorer действительно измерен на собственных 1000/10000/100000 Items. Ограничить N, пакетно загрузить данные, подготовить общие признаки и сохранить выдачу — разные оптимизации; ниже отдельные числа. Batching даёт существенную часть ускорения без слияния canonical collections.
3. **MongoDB достаточно для первой выбранной архитектуры.** Prepared retrieval read model имеет измеренную пользу, но prototype шире необходимого. Новая vector DB/Meili critical path/постоянный Python inference service сейчас не обязательны. Offline Python trainer оправдан measured quality; exported factors проверены в Node.
4. Собственная пригодная история Bisky в исследование не предоставлялась; рабочие БД не проверялись. При её отсутствии публичные модели нельзя просто включить без mapping и связанных собственных interactions. В точечных оценках 0–1 positive popularity лучше принудительной персонализации; отдельный CI порога не рассчитан; предлагаемый default0–4 positives без explicit taste — prior/pop base, затем offline-gated CF+ALS. Explicit preferences/filters сохраняются; content поддерживает new-item режим, но его общая шкала с warm CF не доказана.
5. Персональные готовые списки для всех пользователей не выбраны. Переиспользуются общие данные/модель; active-user buffer добавляется только при окупаемости и source-revision publication guard. Нельзя обещать быструю смысловую смену вкуса из одного like при длинной истории: быстрый fold-in — вычислительная возможность, а recency quality не проверена.

Повторная проверка нашла и закрыла bounded-RRF и часть runtime-пробелов; это не означает выполнения всех экспериментальных пунктов. Явная матрица выполнено/частично/не выполнено — в§11.

**Уровень уверенности:** высокий в статическом восстановлении текущего пути и локальных измерениях указанных конфигураций; умеренный в практическом выборе архитектуры; ограниченный в переносе quality на Bisky, adult-games/cross-media и большом production scale. Новая рекомендательная система не внедрялась.

## 2. Что существует сейчас

### 2.1. Задачи и границы контрактов

У Bisky единый `Item` для семи типов медиа: movie, series, animatedMovie, animatedSeries, animeSeries, animeMovie, game. Возрастная метка `18++` допускается только для игр; разметка adult-контента остаётся свойством каталога. Общий тег может переносить содержательный интерес между типами, но качество такого переноса пока не проверено на связанных пользовательских данных.

Нужно различать три задачи:

| Задача                                 | Требуемая гарантия                                                | Следствие                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Короткая лента / Пик                   | Хорошие допустимые произведения в небольшом окне, быстрая реакция | Допустим ограниченный пул; нельзя обещать исчерпание всего каталога                                          |
| Подбор с фильтрами                     | Строгая допустимость по фильтрам, качество внутри них             | Фильтры применяются при retrieval и повторно перед ответом; редкий фильтр может потребовать расширить бюджет |
| Персональная сортировка всего каталога | Глобальный порядок, точный total, произвольные страницы           | Ограниченный candidate pool не эквивалентен этому контракту                                                  |

Сейчас [RecommendationsService.find](../../../src/endpoints/recommendations/services/recommendations.service.ts) — внутренний сервис, экспортируемый модулем без HTTP-контроллера. Поиск production-потребителей не обнаружил HTTP-вызовов рекомендаций. [Публичный поиск](../../../src/endpoints/search/services/siteSearchService/core/siteSearch.service.ts) использует Meilisearch и MongoDB hydration, без персонального recommendation scorer. Историческое время другого поискового пути здесь не используется.

`find` принимает typed `userId`, `filter`, `country`, library include/only/exclude, excludeItemIds, candidateItemIds, isIncludingExcluded, direction и pagination. Читает профиль и сохранённый средний рейтинг сайта, затем передаёт расчёт ItemRepository. Страница по умолчанию 1, limit 20, максимум 100. Caller отвечает за доступ к указанной collection. При `candidateItemIds=[]` результат пуст; при отсутствии поля ранжируется весь подходящий каталог. Total точен относительно входного множества, а не любого внешнего каталога.

### 2.2. Поток данных

```text
UserItem mutation
  → Mongo transaction: UserItem + дельты ItemStats/SiteStats
  → после commit: BullMQ userTasteProfile.recalculate(user,item)
  → текущие TagItem изменённого Item → затронутые теги
  → соответствующие текущие UserItem → weight/count
  → CAS всего tagPreferences с сохранением explicitWeight

find(user,filters)
  → profile + SiteStats.average
  → Item eligibility
  → ItemStats
  → известные назначенные теги + Tag.parents graph
  → обе ориентации ItemRelation + положительные источники UserItem
  → scores → полный sort → facet(items,total)
```

Точки входа: [UserItemService](../../../src/endpoints/userItem/services/userItemService/core/userItem.service.ts), [UserItemStatsService](../../../src/endpoints/userItem/services/userItemStatsService/core/userItemStats.service.ts), [пересчёт вкуса](../../../src/entities/userTasteProfile/services/userTasteProfileRecalculation.service.ts), [публикация профиля](../../../src/entities/userTasteProfile/services/userTasteProfile.repository.ts), [ItemRepository](../../../src/entities/item/services/itemRepository/core/item.repository.ts).

### 2.3. Фактические формулы

Для оценки r и избранного f сигнал одного произведения:

```text
s(r,f) = (r-5)/4                          r<=4
       = max((r-6)/4, f ? 0.5 : 0)       r>=7
       = f ? 0.5 : 0                     иначе

weight_t = sum(s_ui * relevance_it) / count_t
p_t = explicitWeight_t, если он !=0;
      иначе weight_t * count_t/(count_t+5)
```

Нейтральные оценки 5–6 входят в count с нулевым вкладом. Нет rating/favorite — нет наблюдения. Favorite не суммируется с rating и не отменяет низкую оценку. Completed/прогресс сами по себе не дают вкусового сигнала. Skipped не участвует в профиле; blocked сам по себе не dislike, но сохранённые rating/favorite у blocked могут участвовать. Одно произведение — одно подтверждение независимо от числа попыток.

Перед scoring берутся только известные, назначенные кандидату, применимые к его типу taste-теги с положительной relevance. Назначенный известный дочерний тег подавляет назначенный известный родительский. Незнакомый ребёнок родителя не подавляет; отсутствующие назначения родителей не добавляются. Подготовка общих ancestors возможна, но персональное подавление нельзя заменить заранее выбранными leaf tags.

```text
tasteScore = sum(p_t * relevance_it * weightModifier_t)
             / sum(weightModifier_t)
baseScore = 1 + tasteScore/2
plannedBoost = status==planned ? 0.2 : 0
relationBoost = max((candidateRoleMultiplier-1) * positiveSympathy_source)
finalScore = round(baseScore * (1+plannedBoost+relationBoost),12)
ratingScore = (n*R+20*C)/(n+20), иначе C
```

Знаменатель tasteScore не содержит relevance и учитывает только оставшиеся известные теги. relationBoost берётся по максимуму обеих ориентаций и всех источников; роль принадлежит кандидату относительно источника. Source существует, не удалён, не skipped, имеет положительный rating/favorite; completed не обязателен. Рейтинг — tie-break после finalScore, не основной компонент релевантности. C читается из SiteStats.average, fallback 5.5. `ItemStats.ratingScore` в текущей схеме не хранится.

Источники: [taste pipeline](../../../src/entities/item/functions/createRecommendationTastePipeline/core/createRecommendationTastePipeline.ts), [relation pipeline](../../../src/entities/item/functions/createRecommendationRelationPipeline/core/createRecommendationRelationPipeline.ts), [основной pipeline](../../../src/entities/item/functions/createRecommendationPipeline/core/createRecommendationPipeline.ts), [rating expression](../../../src/entities/itemStats/functions/createItemRatingScoreExpression/core/createItemRatingScoreExpression.ts).

### 2.4. Eligibility и порядок работы

[Первый match](../../../src/entities/item/functions/createItemFilterPipeline/core/createItemFilterPipeline.ts) уже ограничивает candidateItemIds, deletedAt, type и excludeItemIds. Значит, возможность ограничить работу существует без новой коллекции. Далее идут точные поля/даты, AND назначенных tagIds, optional collection/group, UserItem, ItemBan, ItemStats/rating range, taste, relations, полный sort и facet.

По умолчанию исключаются blocked, активный skipped и подходящие ItemBan. Skipped с истёкшим expiresAt доступен до TTL-очистки; null/missing expiry остаётся исключением. `isIncludingExcluded=true` сохраняет рекомендательно исключённые Items в последней сортировочной группе. Это внутренний диагностический контракт; такой флаг не следует автоматически открывать публичному feed.

Library `include` допускает outsiders и указанные статусы; `only` ограничивает указанными; `exclude` выигрывает; include и only несовместимы. `include=[]` — outsiders only, `only=[]` — пусто. Hard filters/deletedAt/excludeItemIds действуют независимо от isIncludingExcluded. Поле rating range использует raw ratingAverage, а не smoothed ratingScore. Сортировка: группа исключений asc → finalScore нужного направления → ratingScore desc → _id asc. Между вызовами snapshot отсутствует.

### 2.5. Коллекции, индексы и уже выполненные оптимизации

| Данные                  | Источник истины / назначение                              | Объявленные индексы                                                       |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Item                    | Канонический каталог                                      | _id; дополнительных в схеме нет                                           |
| Tag                     | Ключ, группа, parents, weightModifier, optional embedding | unique key                                                                |
| TagItem                 | Назначение, relevance                                     | unique(item,tag), (tag,item)                                              |
| UserItem                | Текущее состояние библиотеки/реакции                      | unique(user,item), (item,user), partial TTL skipped.expiresAt             |
| UserTasteProfile        | Производные tag weights/count и явные overrides           | unique user                                                               |
| ItemStats               | Rating/status/favorite/completed aggregates               | unique item                                                               |
| SiteStats               | Сохранённый site prior sum/count/average                  | unique key                                                                |
| ItemRelation / Relation | Типизированные связи / роли                               | first.item+role, second.item+role; unique Relation.key                    |
| ItemBan                 | Глобальные/региональные recommendation exclusions         | unique item                                                               |
| ItemCollection          | Collection/group membership                               | unique(collectionId,item), collection/group/position/_id, item/collection |

Это декларации; фактические планы исследовательских БД приведены ниже. Реальный проект уже использует MongoDB, Redis/BullMQ/cache и Meilisearch. Добавить их в recommendation critical path — отдельное решение, даже если сервис уже установлен.

`ItemStats` и `SiteStats` меняются дельтами в transaction. На каждый find нет полного прохода по оценкам для C. Tag.weightModifier уже пересчитывается ежедневно в 03:00 Europe/Moscow: `clamp(log((groupItemCount+1)/(tagCount+1)),0.25,2)`, с существующими fallback; это не IDF, который требуется изобретать заново. Search Item sync сейчас запускается раз в пять минут, читает весь Item каталог по batches и использует raw rating, без персональных баллов. Наличие updatedSince в общей инфраструктуре не делает конкретный Item source инкрементальным.

### 2.6. Свежесть и ограничения

`keepLastIfActive:true` проверен по установленному BullMQ 6.5.1, включая `storeDeduplicatedNextJob.lua`/`requeueDeduplicatedJob.lua`: активная задача не отменяется, сохраняется последняя последующая задача по dedup key. Key профиля включает user и item; задачи разных Item пользователя могут выполняться параллельно. CAS сравнивает весь предыдущий массив tagPreferences и защищает explicit updates, но не revision исходных UserItem. Реакция между чтением inputs и publish может временно дать старый профиль до follow-up.

Mongo commit и enqueue не атомарны. При потере enqueue профиль может остаться устаревшим; просмотренный путь не содержит outbox. Изменения TagItem синхронизируют tag collections, но не найден subscriber пересчёта вкусов. Удалённый с Item тег не попадает в список текущих затронутых тегов для удаления прежнего вклада. Эти ограничения важнее добавления ещё одного cache.

Нет собственного validated collaborative graph, временного затухания, session interest, exposure history, разнообразия, bounded candidate generator и персонального буфера. Tag.embedding не используется в ranking. Граф родителей не имеет maxDepth в query; стоимость зависит от реальных глубины и разветвления. Профиль ограничен 4096 entries. UserItem.updatedAt изменяется также от note/progress, поэтому не является достоверным ratingAt.

## 3. Источники, методы и отбор алгоритмов

Сначала сравнивались простые решения. Подробно реализованы popularity/smoothed rating, content TFIDF, плоская адаптация Bisky, item-item cosine CF, implicit ALS и RRF; MMR — ограниченный ablation. В таблице нет заимствованных чисел как результатов Bisky.

| Класс                        | Польза                                                      | Цена и отказные режимы                                            | Решение исследования                                                 |
| ---------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Popularity / smoothed rating | Нулевой user cold-start, дешёвый и обязательный baseline    | Неперсонален, head bias, новый Item без истории                   | Оставить baseline/fallback, различать popularity и rating            |
| Content                      | Новый Item, явные признаки/негативы, объяснимость           | Зависимость от разметки, overspecialization, нет CF-сигнала       | Обязательная возможность, качество конкретных metadata измерять      |
| User kNN                     | Прямое соседство пользователей                              | Поиск по растущему U и слабые пересечения                         | Не выбран для serving                                                |
| Item kNN                     | Sparse подготовленные соседи, простое обновление user score | Item cold-start, пары длинных историй, popularity bias            | Реальный CF-baseline; не выбирать автоматически вместо лучшей модели |
| Implicit ALS                 | Компактные факторы, fold-in, сильный проверяемый baseline   | Обучение, модель/versioning, cold-item без metadata               | Реально измерен, основной ML-кандидат                                |
| BPR                          | Pairwise ranking positive>unobserved                        | Negative sampling policy, stochastic training, cold-start         | Рассмотрен; ALS представляет класс MF в глубоком сравнении           |
| SLIM / EASE                  | Сильные простые линейные модели                             | Dense EASE O(I²) storage/O(I³) factorization; SLIM дорог в fit    | Отложены после ресурсного отсечения; превосходство не опровергнуто   |
| LightFM                      | ID+feature embeddings, hybrid cold-start                    | Дополнительная модель/настройка/native dependency                 | Следующий challenger при реальных metadata+interactions              |
| LightGCN / графовые          | Collaborative propagation                                   | Нужен пригодный graph, сложнее fit/update                         | Нет основания внедрять сейчас                                        |
| Text embeddings / ANN        | Семантические кандидаты нового Item                         | Similarity≠preference, multilingual/adult uncertainty, ANN recall | Предусмотреть источник; не обязательная vector DB                    |
| LTR / LambdaMART             | Обучаемое объединение сигналов                              | Нужны корректные labels и exposure/negative policy                | Отложить до собственной пригодной истории                            |
| SASRec и sequence models     | Смена краткосрочного интереса                               | Нужен настоящий журнал действий, snapshot его не заменяет         | Отложить; не выдумывать временные сигналы                            |
| Bandits / online switching   | Измерение exploration/reward                                | Online experimentation за пределами задания                       | Вне scope                                                            |

Принцип двух этапов из [YouTube RecSys 2016](https://research.google.com/pubs/pub45530.html) полезен как разделение обязанностей, но его масштаб и архитектура не являются требованиями Bisky. [Dacrema et al.](https://arxiv.org/abs/1907.06902) обосновывают необходимость настроенных простых baseline. [Krichene–Rendle](https://research.google/pubs/on-sampled-metrics-for-item-recommendation/) показывают, почему результаты с sampled negatives нельзя смешивать с полным каталогом.

Формулы экспериментальных CF/ALS:

```text
itemCF: sim(i,j) = cooccur(i,j)/sqrt(n_i*n_j)
                   * cooccur(i,j)/(cooccur(i,j)+shrink)
        score(u,j) = sum_i positive_ui * sim(i,j)

ALS: min sum_ui c_ui*(p_ui - x_u^T y_i)^2
         + lambda*(sum_u ||x_u||² + sum_i ||y_i||²)
```

В реально использованном `implicit 0.7.3` binary positive matrix с alpha20 означает c=20 у наблюдаемого positive и c=1 у отсутствующего, а не автоматически 1+20. p=1/0 — обучающее слабое implicit preference; отсутствие не объявляется явным пользовательским dislike. [Оригинал ALS](https://yifanhu.net/PUB/cf.pdf) задаёт общую preference/confidence постановку, а точная численная кодировка определяется библиотекой. Негативные Bisky-сигналы нельзя без обоснования заменить unobserved entries этой модели.

## 4. Среда и протокол, зафиксированные до основных прогонов

Host: Windows 11 build 26300 x64 (Node os.release=10.0.26300), Intel i5-13600KF, 20 logical CPU, 34 130 628 608 bytes RAM. В начале свободно около 20.2 GB; это snapshot, не выделенный benchmark host. Node 24.16.0, TypeScript 6.0.3, Mongoose 9.11.4, Nest 12.3.2. Docker Desktop 4.93.0, Engine29.8.1, Linux6.18.33.2/WSL2. Mongo 8.0.17: 2 CPU,3 GiB memory, WiredTiger cache1 GiB. Meilisearch1.12.8: 2 CPU,2 GiB memory; это доступный локальный image, а не утверждение о latest версии.

Python 3.12.14, NumPy 2.3.5, pandas 3.0.1, SciPy 1.18.1, implicit 0.7.3, threadpoolctl3.7.0. BLAS/OpenMP/ALS ограничены одним thread. Версии и threadpool_info сохранены. Python batch scoring нельзя сравнивать напрямую с Mongo service latency; границы каждого измерения указаны.

Исходное рабочее дерево чистое; сохранены SHA-256 1281 tracked files до изменений. Экспериментальные ресурсы: только `bisky-study-20261101-*`, loopback ports27191/27791, собственные DB `bisky_study_20261101_<N>_<seed>`. `.env` и рабочие БД не читались/не использовались. Docker потребовал запуска установленного Desktop и разрешённого доступа к daemon. Нагрузочные quality и Mongo/vector-прогоны координировались последовательно; подготовка/чтение источников могли идти параллельно.

Shortlist/protocol до fit и нагрузки зафиксированы в ранней версии итогового отчёта и рабочих `quality-report.md`. Дополнительные диагностические ablation добавлялись отдельно и не используются для подбора победителя на test. В частности, MMR и ограничение candidate budgets — исследовательские режимы, а не автоматически выбранные по test параметры.

## 5. Датасеты и оценка качества

## Реальные публичные данные и offline quality

Ниже — **наши измерения** на реальных публичных взаимодействиях. Это не качество полной production Bisky, не online satisfaction, не cross-media transfer. Синтетические предпочтения в доказательстве качества не использованы. Полный протокол: `.temp/bisky-study-20261101/quality/quality-report.md`; дополнительные таблицы: `quality/summary.md`; raw JSON/NPZ и скрипты сохранены рядом.

| Dataset | Raw rows | User/item pairs | Raw users | Catalog | Selected users | Selected pairs | Selected positives | Selected density(full catalog) |
| ------- | -------- | --------------- | --------- | ------- | -------------- | -------------- | ------------------ | ------------------------------ |
| anime   | 7813737  | 7813730         | 73515     | 12294   | 6000           | 792621         | 435231             | 1.075%                         |
| steam   | 200000   | 128804          | 12393     | 5155    | 1829           | 96636          | 35672              | 1.025%                         |
| vndb    | 2046771  | 2046771         | 96301     | 38091   | 4670           | 474775         | 205499             | 0.267%                         |

Anime источник — [CooperUnion/MAL](https://www.kaggle.com/datasets/CooperUnion/anime-recommendations-database): target rating>=8, -1 watched-unrated нейтрален; реальные genres доступны. Anime metadata12,294, interacted items11,200; actual users73,515 против 73,516 в описании издателя. Взяты 6000 случайных users с>=10 positives, selection seed20261101, все их наблюдения.

Steam источник — [Tamber/public Steam](https://www.kaggle.com/datasets/tamber/steam-video-games): purchase=владение, play=часы, target=max(playhours)>=2; это engagement, не like. Пары purchase/play объединены, не разнесены между split; все 1829 users с>=5 positives. Нет timestamp/AppID/genres, поэтому content/Bisky на нём не тестировались.

VNDB источник — [официальный votes dump2026-11-01](https://dl.vndb.org/dump/vndb-votes-2026-11-01.gz): VN,user,vote10–100,recorded date; target>=80. Отбор>=5 train positives,>=1val и>=1test дал 4670 users. VN-аудитория близка части adult-игр, но adult subset без metadata не выделен; это не оценка всех adult games.

Лицензии проверены по **реальным ответам API/README**: [Anime CC0-1.0](https://www.kaggle.com/api/v1/datasets/metadata/CooperUnion/anime-recommendations-database), [Steam DbCL-1.0](https://www.kaggle.com/api/v1/datasets/metadata/tamber/steam-video-games), VNDB ODbL+DbCL. Сохранены `*-metadata.json` и официальный `../vndb-dump-README.txt`; это заявленные издателями лицензии, не отдельная юридическая экспертиза исходных прав.

| Original compressed file | Bytes    | SHA256                                                           |
| ------------------------ | -------- | ---------------------------------------------------------------- |
| anime.zip                | 26259955 | 49595ab309d1d773ae66464379dc23d813466199816ae6b24e38bc73b8f2cd12 |
| steam.zip                | 1533033  | 6547ecfe28dd1796d826dc4bc56ec0186a49aaf7d8ea2ae96aa05e90283d9ff3 |
| vndb-votes-2026-11-01.gz | 14081726 | 7f7d75562ae589bb1d07289b84b1121cc17c756d596a390c8030549b6bf1e1dd |

### Протокол и границы сравнения

Anime/Steam: stratified per-user60/20/20 random splits seeds17/29/43; positive и остальные наблюдения разделяются отдельно. Это реконструкция скрытых предпочтений, не прогноз будущего. Hyperparameters выбираются на validation; затем один refit train+val и test без подбора. Каталог полный, sampled negatives нет; train-observed маскируются в validation, train+val-observed — в test, включая слабые/неоценённые наблюдения. Missing не кодируется как явный dislike. Popularity/rating/profile/CF/ALS берут только fit-interactions; metadata aggregate rating/members не используются.

VNDB: train<2023-01-01,validation2023–2024,test>=2025-01-01; только seed17. Это **retrospective recorded-date holdout**, не no-leak исторический replay: официальный source сохраняет старую vote_date при изменении оценки, а dump содержит актуальный rating. Future-value revision leakage и survivor/deletion bias не устранены. Пользователи условно активны в будущих окнах. Frozen catalog известен до cutoff по first recorded vote любого пользователя, как proxy availability, не дате релиза.

VNDB test: 26338 all-positive pairs, 22013 доступны на cutoff, 4325 будущих исключены из основной frozen-catalog задачи; available catalog=30072, users с доступным test target=4412. Коллаборативная модель без metadata для новых ID не имеет сигнала.

Shortlist: popularity positive count; rating `(sum+20*siteMean)/(count+20)`; cosine TFIDF реальных genres; ItemCF `co/sqrt(deg_i*deg_j)*co/(co+shrink)` top100 neighbors, shrink10/100 validation; implicit ALS 20iterations,alpha20,grid(factors,reg)=(32,.05)/(64,.05)/(64,.2). **ItemCF включает popularity tie-fill для нулевых scores**; touched-neighbor-only реализация не наследует его candidate recall.

Content positive использует `(r-6)/4` при r>=7; signed добавляет `(r-5)/4` при r<=4,5–6 и-1 нейтральны. Bisky-flat-adapt применяет форму текущего taste score к плоским реальным genres с relevance/significance=1, shrink=count/(count+5), rating только tie-break; нет исходных hierarchy/groups/modifiers/relations/favorites/explicit reactions. Его слабый результат не доказывает качество полной текущей Bisky с богатыми входными данными.

Hybrid назван явно: anime основной=CF+signed-content, Steam/VNDB=CF+ALS; weighted RRF `a/(60+rank1)+(1-a)/(60+rank2)`,a=.25/.5/.75 validation, union top500 каждого. Историческая fusion использовала точные полные ранги за пределами отдельного top500; это не обычный bounded RRF. Новая проверка ограниченной формулы приведена ниже. Дополнительно anime17 CF+ALS отдельно с grid0/.25/.5/.75/1, где 0/1 допускают standalone. Метрики K20: macro-user Recall/P/NDCG(binary relevance)/HitRate; coverage=unique recommendations/available catalog; novelty=-log2 smoothed train positive frequency; diversity=1−mean cosine genres, только anime.

### Исторические результаты full available catalog

| Dataset | Algorithm        | Splits | NDCG@20 mean±SD | Recall@20 | P@20   | HitRate@20 | Coverage | Novelty bits | Genre diversity |
| ------- | ---------------- | ------ | --------------- | --------- | ------ | ---------- | -------- | ------------ | --------------- |
| anime   | popularity       | 3      | 0.1634±0.0011   | 0.1701    | 0.0906 | 0.7304     | 0.0075   | 8.1042       | 0.7759          |
| anime   | smoothed_rating  | 3      | 0.0582±0.0029   | 0.0611    | 0.0362 | 0.4218     | 0.0054   | 9.8674       | 0.7776          |
| anime   | bisky_flat_adapt | 3      | 0.0017±0.0002   | 0.0012    | 0.0009 | 0.0157     | 0.2037   | 17.0620      | 0.2745          |
| anime   | content_signed   | 3      | 0.0347±0.0013   | 0.0367    | 0.0192 | 0.2714     | 0.3143   | 13.7609      | 0.2837          |
| anime   | CF+pop-fill      | 3      | 0.2621±0.0023   | 0.2585    | 0.1369 | 0.8581     | 0.0486   | 8.4658       | 0.7723          |
| anime   | als              | 3      | 0.3449±0.0021   | 0.3682    | 0.1817 | 0.9366     | 0.1321   | 9.4857       | 0.7645          |
| anime   | CF+content RRF   | 3      | 0.2609±0.0028   | 0.2694    | 0.1414 | 0.8699     | 0.0597   | 8.5324       | 0.7533          |
| steam   | popularity       | 3      | 0.1880±0.0022   | 0.2961    | 0.0417 | 0.5333     | 0.0105   | 7.2436       | n/a             |
| steam   | CF+pop-fill      | 3      | 0.2742±0.0053   | 0.3990    | 0.0548 | 0.6506     | 0.0702   | 7.6124       | n/a             |
| steam   | als              | 3      | 0.2495±0.0055   | 0.3820    | 0.0492 | 0.6289     | 0.1248   | 8.7528       | n/a             |
| steam   | CF+ALS RRF       | 3      | 0.2868±0.0063   | 0.4204    | 0.0589 | 0.6703     | 0.0793   | 7.7790       | n/a             |
| vndb    | popularity       | 1      | 0.0760          | 0.1271    | 0.0257 | 0.3098     | 0.0043   | 7.7283       | n/a             |
| vndb    | smoothed_rating  | 1      | 0.0661          | 0.1320    | 0.0257 | 0.3311     | 0.0024   | 8.7876       | n/a             |
| vndb    | CF+pop-fill      | 1      | 0.1195          | 0.1938    | 0.0395 | 0.4350     | 0.0360   | 8.5360       | n/a             |
| vndb    | als              | 1      | 0.1345          | 0.2240    | 0.0441 | 0.4787     | 0.0458   | 9.2526       | n/a             |
| vndb    | CF+ALS RRF       | 1      | 0.1367          | 0.2252    | 0.0447 | 0.4830     | 0.0442   | 9.0312       | n/a             |

SD — различие 3 random split/init runs, не confidence interval. Population одинаковая внутри dataset, hyperparameters validation-selected отдельно по run. Rating-only и genre-only заметно слабее collaborative на этих target definitions; богатый Bisky content, lexical/semantic embeddings и LTR этими числами не опровергаются.

| Dataset | A−B NDCG@20(seed17)     | Users | Mean delta | 95% paired CI        |
| ------- | ----------------------- | ----- | ---------- | -------------------- |
| anime   | itemcf-minus-popularity | 6000  | 0.09886    | [0.09502, 0.10246]   |
| anime   | als-minus-itemcf        | 6000  | 0.08228    | [0.07767, 0.08701]   |
| anime   | hybrid-minus-itemcf     | 6000  | -0.00024   | [-0.00279, 0.00213]  |
| anime   | hybrid-minus-als        | 6000  | -0.08252   | [-0.08747, -0.07811] |
| steam   | itemcf-minus-popularity | 1829  | 0.07949    | [0.06981, 0.08946]   |
| steam   | als-minus-itemcf        | 1829  | -0.02438   | [-0.03528, -0.01358] |
| steam   | hybrid-minus-itemcf     | 1829  | 0.01158    | [0.00687, 0.01602]   |
| steam   | hybrid-minus-als        | 1829  | 0.03596    | [0.02726, 0.04468]   |
| vndb    | itemcf-minus-popularity | 4412  | 0.04348    | [0.03964, 0.04782]   |
| vndb    | als-minus-itemcf        | 4412  | 0.01503    | [0.01038, 0.01963]   |
| vndb    | hybrid-minus-itemcf     | 4412  | 0.01727    | [0.01374, 0.02095]   |
| vndb    | hybrid-minus-als        | 4412  | 0.00223    | [0.00024, 0.00426]   |

Paired bootstrap1000 resamples пользователей, условно на data/split, не population-transfer CI. Вывод зависит от семантики targets и разреженности: один безусловный лучший алгоритм не найден. Насильственное добавление weak content не оправдано.

Дополнительный anime17 CF+ALS: validation-selected CF weight=0.25; test NDCG@20=0.3604,Recall@20=0.3781; ΔvsALS=0.01484,95%CI[0.01266, 0.01701]. Это отдельный run, не переименование CF+content.

### История и longtail(seed17)

| Dataset | Fit positive history | Users | Pop NDCG | CF NDCG | ALS NDCG | Hybrid NDCG | ALS Recall@20 | ALS P@20 |
| ------- | -------------------- | ----- | -------- | ------- | -------- | ----------- | ------------- | -------- |
| anime   | 6-20                 | 1708  | 0.1469   | 0.2529  | 0.3463   | 0.2489      | 0.4937        | 0.0725   |
| anime   | 21-100               | 3364  | 0.1542   | 0.2429  | 0.3416   | 0.2444      | 0.3607        | 0.1947   |
| anime   | 101+                 | 928   | 0.2338   | 0.3565  | 0.3587   | 0.3568      | 0.1748        | 0.3373   |
| steam   | 0-5                  | 422   | 0.1569   | 0.2801  | 0.2538   | 0.2843      | 0.4621        | 0.0231   |
| steam   | 6-20                 | 1021  | 0.1954   | 0.2636  | 0.2527   | 0.2783      | 0.4007        | 0.0402   |
| steam   | 21-100               | 373   | 0.2074   | 0.2678  | 0.2124   | 0.2802      | 0.2350        | 0.0979   |
| steam   | 101+                 | 13    | 0.2367   | 0.3261  | 0.1990   | 0.3075      | 0.1115        | 0.1885   |
| vndb    | 6-20                 | 1675  | 0.0974   | 0.1528  | 0.1747   | 0.1749      | 0.3034        | 0.0450   |
| vndb    | 21-100               | 2513  | 0.0654   | 0.1019  | 0.1140   | 0.1173      | 0.1834        | 0.0441   |
| vndb    | 101+                 | 224   | 0.0347   | 0.0669  | 0.0635   | 0.0693      | 0.0856        | 0.0371   |

У длинной истории больше test targets: падение Recall@20 само по себе не означает ухудшения релевантности; смотрим NDCG/P вместе. Head=top1% items с train positives; tail=1–5 positives; zero_train=0 positives, не обязательно новый item.

| Dataset | Algorithm | Head microRecall(hits/targets) | Tail microRecall | Zero_train microRecall |
| ------- | --------- | ------------------------------ | ---------------- | ---------------------- |
| anime   | itemcf    | 0.7265 (11668/16061)           | 0.0022 (3/1366)  | 0.0000 (0/301)         |
| anime   | als       | 0.5198 (8348/16061)            | 0.0000 (0/1366)  | 0.0000 (0/301)         |
| anime   | hybrid    | 0.7135 (11460/16061)           | 0.0029 (4/1366)  | 0.0000 (0/301)         |
| steam   | itemcf    | 0.9266 (1300/1403)             | 0.0015 (1/665)   | 0.0000 (0/229)         |
| steam   | als       | 0.5502 (772/1403)              | 0.0045 (3/665)   | 0.0000 (0/229)         |
| steam   | hybrid    | 0.8995 (1262/1403)             | 0.0015 (1/665)   | 0.0000 (0/229)         |
| vndb    | itemcf    | 0.5074 (3059/6029)             | 0.0009 (2/2130)  | 0.0000 (0/815)         |
| vndb    | als       | 0.4712 (2841/6029)             | 0.0000 (0/2130)  | 0.0000 (0/815)         |
| vndb    | hybrid    | 0.5044 (3041/6029)             | 0.0000 (0/2130)  | 0.0000 (0/815)         |

Высокий overall NDCG не решает rare/new-item задачу; большинство tail targets не попадает в top20. Нельзя выдавать higher coverage за доказанное качество новых произведений.

### Контролируемые cold-start ablations

Artificial-history:300 реальных eval users целиком исключены из fit глобальных моделей/статистик, supplied profile0/1/5/all позитивных pre-test interactions, mask только supplied items. ALS делает exact fold-in; невидимая история не используется. Это укорачивание настоящих историй, не реальные новички и не синтетические вкусы. При h0 все персональные scores0, один train-pop fallback.

| Dataset | Users | Supplied positives | Pop NDCG | CF NDCG | FoldALS NDCG | Content NDCG | FoldALS Recall@20 |
| ------- | ----- | ------------------ | -------- | ------- | ------------ | ------------ | ----------------- |
| anime   | 300   | 0                  | 0.1063   | 0.1063  | 0.1063       | 0.1063       | 0.1314            |
| anime   | 300   | 1                  | 0.1068   | 0.1011  | 0.0850       | 0.0284       | 0.0955            |
| anime   | 300   | 5                  | 0.1089   | 0.1552  | 0.1567       | 0.0313       | 0.1957            |
| anime   | 300   | all                | 0.1465   | 0.2368  | 0.3038       | 0.0341       | 0.3408            |
| steam   | 300   | 0                  | 0.1509   | 0.1509  | 0.1509       | n/a          | 0.2803            |
| steam   | 300   | 1                  | 0.1521   | 0.1320  | 0.1187       | n/a          | 0.1953            |
| steam   | 300   | 5                  | 0.1614   | 0.2228  | 0.1829       | n/a          | 0.3094            |
| steam   | 300   | all                | 0.1781   | 0.2500  | 0.2337       | n/a          | 0.3638            |
| vndb    | 300   | 0                  | 0.0521   | 0.0521  | 0.0521       | n/a          | 0.0809            |
| vndb    | 300   | 1                  | 0.0533   | 0.0500  | 0.0483       | n/a          | 0.1032            |
| vndb    | 300   | 5                  | 0.0596   | 0.0581  | 0.0613       | n/a          | 0.1166            |
| vndb    | 300   | all                | 0.0762   | 0.1029  | 0.1097       | n/a          | 0.2083            |

Artificial cold-item anime:seed4901,случайные 10% items с>=5pre-test positives (372 items), все их 58879 fit observations удалены, real genres сохранены;7669 настоящих cold-item test positives. Все параметры взяты из исходной validation; target CSR очищен от explicit zeros.

| Algorithm        | Users with cold targets | NDCG@20 | Recall@20 | Candidate Recall@500 |
| ---------------- | ----------------------- | ------- | --------- | -------------------- |
| popularity       | 3482                    | 0.0000  | 0.0000    | 0.0000               |
| content_positive | 3482                    | 0.0088  | 0.0205    | 0.2641               |
| content_signed   | 3482                    | 0.0089  | 0.0204    | 0.2668               |
| bisky_flat_adapt | 3482                    | 0.0003  | 0.0005    | 0.0370               |
| itemcf           | 3482                    | 0.0000  | 0.0000    | 0.0000               |
| als              | 3482                    | 0.0000  | 0.0000    | 0.0000               |

Metadata route необходим структурно, но слабые genres не гарантируют хорошую cold-item релевантность. Public datasets не доказывают cross-media перенос: users между MAL/Steam/VNDB не связаны.

### Candidate retrieval отдельно от reranking

| Dataset | Predefined pool  | Candidate Recall | Mean pool | ALS NDCG@20 | ALS Recall@20 | ΔNDCG vs full ALS | 95%CI               |
| ------- | ---------------- | ---------------- | --------- | ----------- | ------------- | ----------------- | ------------------- |
| anime   | cf100            | 0.5617           | 100.0     | 0.3556      | 0.3725        | 0.01006           | [0.00827, 0.01176]  |
| anime   | cf500            | 0.8875           | 500.0     | 0.3477      | 0.3718        | 0.00213           | [0.00179, 0.00251]  |
| anime   | cf1000           | 0.9396           | 1000.0    | 0.3461      | 0.3703        | 0.00049           | [0.00035, 0.00065]  |
| anime   | cf500_pop500     | 0.8986           | 637.3     | 0.3466      | 0.3707        | 0.00098           | [0.00072, 0.00126]  |
| anime   | cf500_content500 | 0.9067           | 924.0     | 0.3474      | 0.3715        | 0.00184           | [0.00155, 0.00215]  |
| steam   | cf100            | 0.6380           | 100.0     | 0.2532      | 0.3940        | 0.00881           | [0.00612, 0.01143]  |
| steam   | cf500            | 0.8496           | 500.0     | 0.2457      | 0.3814        | 0.00131           | [0.00078, 0.00194]  |
| steam   | cf1000           | 0.9285           | 1000.0    | 0.2444      | 0.3791        | 0.00003           | [0.00000, 0.00007]  |
| steam   | cf500_pop500     | 0.8852           | 620.0     | 0.2443      | 0.3789        | -0.00004          | [-0.00025, 0.00013] |
| vndb    | cf100            | 0.4618           | 100.0     | 0.1361      | 0.2270        | 0.00164           | [0.00036, 0.00280]  |
| vndb    | cf500            | 0.7335           | 500.0     | 0.1351      | 0.2250        | 0.00065           | [0.00028, 0.00103]  |
| vndb    | cf1000           | 0.8030           | 1000.0    | 0.1349      | 0.2245        | 0.00037           | [0.00010, 0.00064]  |
| vndb    | cf500_pop500     | 0.7621           | 667.1     | 0.1346      | 0.2243        | 0.00006           | [-0.00018, 0.00030] |

CF pools включают pop tie-fill; unions max1000. Пул выбирается до ALS; утраченный target reranker не вернёт. Бюджеты заранее заданы, не retuned на test. Это quality experiment с полноразмерными offline score buffers: wall times этого harness не являются оптимальной online реализацией. Main ALS и этот reranker используют cached train factors; exact fold-in проверен отдельно ниже.

Candidate Recall в этой таблице — **macro по пользователям**, непосредственно измеренный на ID пула до ranking; micro по всем target pairs имеет другой вес пользователей. Финальный аудит обнаружил отдельную ошибку вспомогательного generic Recall@500 для pool100: он считал padded −Infinity IDs. В таблицу эта величина не попадала. Raw cf100 Recall@500 исправлен из независимо сохранённого measured candidate-stage recall (finite pool100 целиком входит в top500), evaluator добавил finite check; NDCG/Recall@20, кандидатные пулы и выбранные параметры не изменились. Причина/старые значения сохранены в finite-pool-metric-audit.json; повторного test-подбора не было.

### Negatives, diversity и serving parity

Signed-content vs positive-content anime17 ΔNDCG=0.00012,95%CI[-0.00029, 0.00047]. Отдельный ALS explicit-low-rating ablation:16596 negative fit pairs/2551 users, input=−(5−rating)/4 для 1..4; implicit p=0,c=abs(alpha*input),missing c=1,-1 не negative. Fixed selected params: NDCG=0.3441,Recall=0.3686; ΔvspositiveALS=-0.00146,95%CI[-0.00261, -0.00038]. Это один mapping, не доказанный optimal weight и не семантика skip/block.

| Anime3 seeds | NDCG@20 | Recall@20 | Coverage | Genre diversity | Novelty bits |
| ------------ | ------- | --------- | -------- | --------------- | ------------ |
| hybrid       | 0.2609  | 0.2694    | 0.0597   | 0.7533          | 8.5324       |
| mmr_l0.8     | 0.2621  | 0.2703    | 0.0587   | 0.7656          | 8.5142       |
| mmr_l0.95    | 0.2618  | 0.2698    | 0.0596   | 0.7557          | 8.5275       |

MMR на top100 CF+content, lambda.8/.95 заранее заданы; по test победитель не выбирался. Genre diversity — узкая metadata proxy, не самостоятельная пользовательская польза.

| Dataset | ALS selected params | Exact fold NDCG@20 | Exact fold Recall@20 | ΔNDCG vs cached CG | 95%CI               |
| ------- | ------------------- | ------------------ | -------------------- | ------------------ | ------------------- |
| anime   | als_f64_r0.2        | 0.3462             | 0.3706               | 0.00066            | [0.00026, 0.00106]  |
| steam   | als_f32_r0.05       | 0.2443             | 0.3792               | -0.00006           | [-0.00099, 0.00088] |

Exact Cholesky recalculate_user использует final Y, cached fit uses CG. Поэтому математический Node/Python parity100 histories дополнен quality evaluation всех eligible users; их равенство заранее не предполагалось. VNDB fold-quality не измерялось. Быстрый fold-in не доказывает сильной semantic смены вкуса после 1like при 500 старых; recency/decay quality не проверена.

### Реальный Python implicit serving: ограниченный technical benchmark

Python 3.12.14/NumPy 2.3.5/pandas 3.0.1/SciPy 1.18.1/implicit 0.7.3;1BLAS/ALS thread.1000 samples на операцию,+50warmup; data/model RAM, all-history known-item filtering,N20. Это не Mongo/HTTP/cards latency. В c4 latency исключает executor queue, batch throughput включает dispatch. First API call не равен cold process/OS cache.

| Dataset | Items | Users | Fit positives | Fit wall s | Fit CPU s | Factor bytes | Serialized bytes | RSS after fit bytes |
| ------- | ----- | ----- | ------------- | ---------- | --------- | ------------ | ---------------- | ------------------- |
| anime   | 12294 | 6000  | 350484        | 1.524      | 1.484     | 4683264      | 4686659          | 190062592           |
| steam   | 5155  | 1829  | 29175         | 0.185      | 0.188     | 893952       | 897347           | 111894528           |
| vndb    | 38091 | 4670  | 179161        | 0.828      | 0.812     | 5473408      | 5476803          | 166674432           |

| Dataset | Recommend p50/95/99 ms | Fold p50/95/99 ms | Fold+recommend c1 ms | Fold+recommend c4 ms | c1 batch calls/s | c4 batch calls/s |
| ------- | ---------------------- | ----------------- | -------------------- | -------------------- | ---------------- | ---------------- |
| anime   | 0.101/0.188/0.307      | 0.068/0.184/0.286 | 0.166/0.368/0.509    | 0.827/1.609/2.225    | 5139.8           | 4298.5           |
| steam   | 0.059/0.116/0.225      | 0.039/0.108/0.165 | 0.088/0.223/0.317    | 0.780/1.521/2.125    | 9513.1           | 4557.4           |
| vndb    | 0.156/0.265/0.457      | 0.045/0.120/0.188 | 0.195/0.355/0.523    | 0.806/1.712/2.318    | 4529.4           | 4281.7           |

Время обучения не включает разбор входных файлов и создание разреженной матрицы. RSS включает среду исполнения, данные и матрицы, а не только модель; пик RSS мог возникнуть до обучения. CPU, индивидуальные наблюдения и первые вызовы сохранены в `*-serving.json`. Четыре клиента не обязаны ускорять маленькие задачи. Миллионные каталоги и аудитории этими датасетами не проверены; отдельные Node/synthetic измерения относятся к своей границе расчёта.

### Достоверность и воспроизводимость

Независимый аудит обнаружил stored-zero ошибку sparse availability mask: первый VNDB17 invalid и сохранён только в `superseded/`, итоговые таблицы используют повтор после eliminate_zeros(). Anime/Steam all-true masks не затронуты; cold/rerank ещё не запускались до исправления. Проверены unique/disjoint user-item splits, CF diagonal0, target data>0, отдельный metric oracle/mask/tie/bootstrap-identity; `metric-checks.log`, `final-run-events.json`, source SHA/versions в logs.

Точные scripts/commands/seeds/grid/config и per-user metrics сохранены; `download.py` проверяет SHA256 и отвергает изменившийся dataset content. Сначала `download.py`, затем `prepare.py`, основные `benchmark.py --dataset NAME --seed SEED`, затем `run_final.py` запускает дополнительные последовательные эксперименты. Current compressed source snapshots сохранены локально, поскольку VNDB exact-date download может ротироваться. Dependencies установлены только в `quality/deps`, production/package manifests не менялись. Raw public users/model exports не попадают в git.

Ограничения: нет полной exposure/impression truth, невозможно считать неизвестные пары dislikes; public labels и selection отличаются от Bisky, истинные adult/cross-media/session-drift/user-satisfaction выводы отсутствуют. Победители условны на shortlist/fit budget/метрики, не объявляются объективно лучшими для реальных Bisky пользователей. Пустая история Bisky требует fallback; публичные модели не готовы к загрузке без подтверждённого catalog mapping и связанных пользовательских сигналов.

### Повторная проверка: ограниченный RRF и exact fold-in

Найдено различие между исходным экспериментом и дешёвым serving: старый RRF выдавал только union top500, но использовал полные ранги обоих источников, включая ранг>500 для предмета, отсутствующего в одном списке. Это корректная full-rank policy, однако её качество и цену нельзя автоматически переносить на два возвращённых ограниченных списка.

Проведён отдельный эксперимент `recheck/bounded_rrf.py`: contribution источника равен нулю при отсутствии предмета в его top500; cap500 каждого активного источника, CF сохраняет popularity tie-fill. Базовые CF/ALS параметры фиксированы прежней validation. Alpha заново выбрана только на validation из 0/.25/.5/.75/1; test не использовался для выбора. Все прежние full-rank validation/test NDCG воспроизведены с ошибкой<1.1e-15.

| Dataset,seed17 | CF weight | Legacy full-rank NDCG@20 | Bounded NDCG@20 | Bounded Recall@20 | ΔNDCG bounded−legacy,95%CI      |
| -------------- | --------- | ------------------------ | --------------- | ----------------- | ------------------------------- |
| anime          | 0.25      | 0.360417                 | 0.360530        | 0.378215          | 0.000113 [0.000030,0.000199]    |
| steam          | 0.75      | 0.280311                 | 0.279992        | 0.418544          | -0.000319 [-0.000721,-0.000016] |
| vndb           | 0.25      | 0.136730                 | 0.136729        | 0.225157          | -0.000001 [-0.000022,0.000015]  |

Выбранные alpha совпали с прежними. На этих трёх seed17 tasks bounded CF+ALS остался лучше обоих самостоятельных источников по paired95% CI. Отличия от legacy малы, но их пришлось проверить фактически. Прежние средние 3 seeds описывают старую policy; новый bounded протокол пока не проверен на 3 seeds.

Затем `recheck/folded_bounded.py` проверил всю bounded CF+ALS policy с **exact Cholesky fold-in для всех eligible users** при фиксированной validation-alpha. Сначала воспроизведён cached-bounded baseline, затем изменены только пользовательские факторы. Никакой настройки на test. Это закрывает прежний пробел между cached-CG quality и предлагаемым request-time fold-in, без предположения об их равенстве.

| Dataset,seed17 | Users | Exact-folded bounded NDCG@20 | Recall@20 | ΔNDCG против cached-bounded,95%CI |
| -------------- | ----- | ---------------------------- | --------- | --------------------------------- |
| anime          | 6000  | 0.360896                     | 0.378840  | 0.000366 [-0.000084,0.000838]     |
| steam          | 1829  | 0.281108                     | 0.419106  | 0.001116 [0.000297,0.002014]      |
| vndb           | 4412  | 0.136772                     | 0.224810  | 0.000043 [-0.000365,0.000452]     |

Фактические matrices/per-user metrics/JSON сохранены в `recheck/*-bounded-rrf.json`, `*-folded-bounded.json`, `*-folded-bounded-per-user.npz`. Обе сводки имеют отдельные имена, исторические исходные результаты не перезаписаны. Для anime экспортированы тот же sparse CF100 graph, popularity и 100 профилей с ожидаемым bounded CF+exact-folded ALS top20; повторный fit item factors совпал с original factors абсолютно. Node implementation должна сохранить float32 accumulation/fusion и tie по train-popularity/ID.

Эти дополнения не доказывают качество реальных Bisky пользователей, cross-media transfer, adult-specific subset или смену вкуса после новой реакции; VNDB остаётся retrospective recorded-date задачей с возможными revisions старых оценок. При повторной проверке всех 7 основных per-user NPZ агрегаты, cohorts и validation выбор CF/ALS совпали с JSON до 1e-12; numeric errors0.

Дополнительные CF+ALS исследования использовали уже рассматривавшийся test split. Их hyperparameters выбирались по validation, но это расширение исследовательского shortlist, а не новая независимая подтверждающая выборка; для выпуска нужна собственная заранее зафиксированная holdout-проверка.

## 6. Технические эксперименты

### 6.1. Что именно выполнялось

Настоящие TS production-классы загружались через изолированный CommonJS transpile hook TypeScript: `RecommendationsService`, `ItemRepository`, схемы и все вызываемые pipeline builders. Источники не переписывались в имитацию. Создавались реальные Mongoose models/schema indexes; внешние приложение/auth/mail/storage не запускались. Измеряется service boundary `find` целиком с чтением профиля/prior, query, projection карточек и pagination; публичного HTTP recommendation endpoint в проекте нет. Сетевой HTTP и frontend rendering в эти числа не входят.

Синтетический каталог детерминирован по xorshift seed: 128 истинно синтетических genre tags, 8 assignments/item, relevance .5/.75/1, некоторые parent links, один ItemRelation на пять Items, рейтинги с перекосом counts, повторяющийся общий tag0, game/animeSeries пополам, removed и global-banned Items. У user0 200 UserItems и 40 известных тегов, у user1 5/5, у user2 0/0. Остальные истории 20; для 100k каталога создано 10kusers, для меньших 100 users. Это нагрузочный граф, не модель реального распределения вкусов; качество на нём не доказывается. Датасеты с реальной популярностью исследованы отдельно.

В 100k одновременно увеличено число пользователей и размер индексов UserItem: это реалистичный совокупный scale scenario, а не чистая оценка производной latency только по I. До 1M физически масштабируются factor arrays, но не вся нормализованная MongoDB-схема: полный million-item/million-user эксперимент сознательно оставлен за бюджетом локального исследования (Mongo 3 GiB, общий host, длительность прогона). Для него даны только storage lower bounds и критерии следующего load-теста; линейного прогноза latency нет.

Режимы разделяют три эффекта:

1. `production.full` / `production.bounded`: один и тот же настоящий scorer, разный N до joins.
2. `batchRaw`: пакетные чтения существующих Item/TagItem/Tag/Stats/Relation/UserItem/Ban и JS scoring без persistent feature collection. Общий словарь 128 тегов читается в каждом запросе; это допущение benchmark, не доказательство дешевизны любого словаря.
3. `prepared`: экспериментальный StudyFeature с назначениями, общими ancestors, score inputs и связями; JS выполняет персональное suppression, eligibility, scoring, sort, получает 20 карточек. Полный состав read model в этой проверке шире рекомендуемого минимального production read model.
4. `snapshot.validatedRead`: ID/score20 результатов, актуальные Item/UserItem/ItemBan checks при чтении. Это измерение cache hit cost, а не готовый безопасный production cache со всеми invalidation/freshness guarantees.
5. `retrieval.mongo/meili`: одинаковые type+tag+deleted filters, точный общий рейтинг desc и ID asc, top100. Сверяется совпадение всех IDs; Meili `rankingRules=['sort']`. Это сравнение одинаковой семантики retrieval, не всей рекомендации.
6. `prepared.retrievalRankCards.e2e`: до 8 tag/type top100 источников плюс общий top200 → dedup/cap1000 → load/rank/late cards. Это измерение стоимости статического экспериментального пути, но не доказательство корректной выдачи при изменениях после materialization. Повторная проверка обнаружила discarded canonical cards, региональные ограничения rawBatch и нарушение порядка snapshot (§6.9). Его candidate recall не равен качественным CF/ALS-пулам.

Сравнение prepared/raw с production включает top20 ID/score parity на фиксированном одинаковом пуле. Синтетика покрывает используемые ветки тегов, родителей, planned, skips, blocks, bans и relations; это не доказательство эквивалентности всех произвольных production inputs. Полные существующие integration checks отдельно.

В sample записывается first call, ещё 2 warmup, затем N измеренных вызовов; c4 — четыре одновременно ожидающих клиента, elapsed throughput на всём batch. First call не означает холодный OS cache: данные уже загружались при seed. Для p99 при N<100 оценка почти равна максимуму; у full100k малая выборка и percentiles не используются как надёжный SLO. Все individual observations сохранены.

Mongo `explain('executionStats')` запускается отдельно от latency sample. Его stage estimates не складываются как независимые времена; это диагностические cumulative estimates, не точная декомпозиция wall clock. Документация предупреждает, что explain не использует и не заполняет обычный plan cache: [Mongo 8 explain](https://www.mongodb.com/docs/v8.0/reference/explain-results/). `allowDiskUse=true` сохранён как в production. CPU — deltas Node process.cpuUsage и container cgroup usage_usec вокруг batch; memory.current/peak — фактические счётчики контейнера, peak относится к его lifetime. Disk — dbStats/collStats и реальный Meili data-dir; image layers учитываются отдельно.

### 6.2. Нынешний production-путь: фактические измерения

| Items  | Режим                   | N   | Clients | First ms | p50 ms   | p95 ms   | p99 ms   | Calls/s | Mongo+Node CPU ms/call |
| ------ | ----------------------- | --- | ------- | -------- | -------- | -------- | -------- | ------- | ---------------------- |
| 1000   | full,40known/200library | 50  | 1       | 846.11   | 817.89   | 837.82   | 847.60   | 1.221   | 826.70                 |
| 1000   | full,0known/0library    | 10  | 1       | 459.74   | 461.94   | 475.29   | 475.29   | 2.155   | 465.82                 |
| 1000   | full,5known/5library    | 10  | 1       | 655.97   | 658.33   | 662.53   | 662.53   | 1.534   | 656.08                 |
| 1000   | game+exact tag          | 10  | 1       | 64.56    | 63.83    | 76.79    | 76.79    | 15.399  | 67.33                  |
| 1000   | candidate IDs200        | 30  | 1       | 168.82   | 169.11   | 177.44   | 181.54   | 5.901   | 171.44                 |
| 1000   | candidate IDs1000       | 30  | 1       | 824.78   | 842.99   | 859.53   | 863.47   | 1.187   | 847.35                 |
| 1000   | full,c4                 | 40  | 4       | 827.10   | 1654.32  | 1791.91  | 1860.46  | 2.393   | 887.04                 |
| 10000  | full,40known/200library | 20  | 1       | 8748.56  | 8850.04  | 8993.94  | 9002.58  | 0.113   | 8903.25                |
| 10000  | full,0known/0library    | 10  | 1       | 4820.63  | 4814.51  | 4889.54  | 4889.54  | 0.208   | 4842.56                |
| 10000  | full,5known/5library    | 10  | 1       | 6639.88  | 6614.10  | 6677.41  | 6677.41  | 0.151   | 6663.05                |
| 10000  | game+exact tag          | 10  | 1       | 513.40   | 500.60   | 515.67   | 515.67   | 1.990   | 516.89                 |
| 10000  | candidate IDs200        | 30  | 1       | 175.31   | 178.38   | 193.21   | 195.85   | 5.561   | 180.74                 |
| 10000  | candidate IDs1000       | 30  | 1       | 894.50   | 853.11   | 881.07   | 951.70   | 1.164   | 862.10                 |
| 10000  | full,c4                 | 12  | 4       | 8742.97  | 17394.83 | 17548.10 | 17548.10 | 0.230   | 9251.51                |
| 100000 | full,40known/200library | 3   | 1       | 87186.96 | 88447.44 | 88890.58 | 88890.58 | 0.011   | 89017.94               |
| 100000 | candidate IDs200        | 10  | 1       | 182.31   | 180.65   | 195.39   | 195.39   | 5.501   | 187.83                 |
| 100000 | candidate IDs1000       | 10  | 1       | 876.32   | 884.53   | 915.70   | 915.70   | 1.126   | 899.79                 |

Full100k: первый вызов плюс 3 измерения без дополнительных warmup. При N3/10/12/20 хвостовые процентили описательны и не являются надёжным productionp99. Full100k нужен как подтверждение масштаба, а не длительный load study. First call не OS-cold. Mongo+Node CPU — approximate counter deltas, включая небольшой overhead считывания cgroup.

### 6.3. Независимые эффекты: batching, materialization и ограничение N

| Items  | Режим                       | N   | Clients | p50 ms  | p95 ms  | p99 ms  | Calls/s | Mongo+Node CPU ms/call |
| ------ | --------------------------- | --- | ------- | ------- | ------- | ------- | ------- | ---------------------- |
| 1000   | Batch canonical1000         | 100 | 1       | 49.32   | 67.32   | 71.49   | 19.2    | 70.61                  |
| 1000   | Prepared full               | 30  | 1       | 23.91   | 27.55   | 28.18   | 41.2    | 19.90                  |
| 1000   | Prepared1000                | 100 | 1       | 24.28   | 28.47   | 30.74   | 40.5    | 23.55                  |
| 1000   | Prepared1000,c4             | 100 | 4       | 71.23   | 102.65  | 131.22  | 52.6    | 31.18                  |
| 1000   | Coarse retrieval→rank→cards | 100 | 1       | 16.17   | 19.11   | 19.93   | 60.7    | 14.24                  |
| 1000   | Snapshot20+current checks   | 200 | 1       | 1.71    | 2.43    | 3.00    | 563.6   | 1.53                   |
| 10000  | Batch canonical1000         | 100 | 1       | 42.77   | 64.05   | 68.36   | 21.3    | 70.46                  |
| 10000  | Prepared full               | 30  | 1       | 198.45  | 255.14  | 256.62  | 4.9     | 217.87                 |
| 10000  | Prepared1000                | 100 | 1       | 26.17   | 32.33   | 34.51   | 37.5    | 21.70                  |
| 10000  | Prepared1000,c4             | 100 | 4       | 72.38   | 107.85  | 131.01  | 53.3    | 29.91                  |
| 10000  | Coarse retrieval→rank→cards | 100 | 1       | 26.73   | 29.94   | 35.21   | 36.9    | 23.69                  |
| 10000  | Snapshot20+current checks   | 200 | 1       | 1.51    | 2.06    | 2.29    | 636.0   | 1.46                   |
| 100000 | Batch canonical1000         | 100 | 1       | 44.56   | 61.76   | 68.17   | 21.1    | 69.71                  |
| 100000 | Prepared full               | 10  | 1       | 1952.16 | 1969.65 | 1969.65 | 0.5     | 2532.02                |
| 100000 | Prepared1000                | 100 | 1       | 23.42   | 26.76   | 28.69   | 42.3    | 20.37                  |
| 100000 | Prepared1000,c4             | 100 | 4       | 71.56   | 97.72   | 113.26  | 54.2    | 29.09                  |
| 100000 | Coarse retrieval→rank→cards | 100 | 1       | 27.20   | 29.45   | 30.53   | 36.6    | 26.69                  |
| 100000 | Snapshot20+current checks   | 200 | 1       | 1.55    | 2.25    | 2.77    | 615.5   | 1.95                   |

Prepared/batchRaw1000 используют один фиксированный пул первых 1000IDs. Coarsee2e использует более маленькое фактическое пересечение tag/type списков, поэтому его преимущество нельзя целиком приписать read model. Snapshot читает 20ID, а не повторяет ranking1000. Full prepared сканирует каталог и всё ещё растёт с I. Новые быстрые пути не становятся автоматически точным глобальным find.

| Items  | Prepared top20 parity | Max score error | Raw-batch top20 parity | Build wall ms | Build Node RSS MiB | Prepared BSON MiB | Prepared storage MiB | Prepared indexes MiB | DB BSON MiB до readmodel |
| ------ | --------------------- | --------------- | ---------------------- | ------------- | ------------------ | ----------------- | -------------------- | -------------------- | ------------------------ |
| 1000   | true                  | 0.000000000000  | true                   | 244.81        | 234.30             | 1.17              | 0.00                 | 0.38                 | 1.46                     |
| 10000  | true                  | 0.000000000000  | true                   | 1052.54       | 407.43             | 11.74             | 0.00                 | 3.27                 | 9.48                     |
| 100000 | true                  | 0.000000000000  | true                   | 8883.10       | 1719.46            | 117.45            | 19.21                | 31.38                | 143.09                   |

storageSize — ранний snapshot после build, а не устойчивый post-checkpoint disk cost:0.00 MiB при 1k/10k не означает нулевое место. Повторный 1k checkpoint приведён в§6.9. Materialization цифры включают чтение исходных коллекций, построение ancestors/features, запись и создание трёх индексов. Prototype хранит карточки и связи шире минимальной спецификации; размеры не выдаются за точный размер будущей схемы. Цена одного read model не смешивается с источниками истины.

| Items  | Контекст                         | Node RSS MiB | Node heap MiB | Mongo current MiB | Mongo lifetime peak MiB | Meili current MiB | Meili lifetime peak MiB |
| ------ | -------------------------------- | ------------ | ------------- | ----------------- | ----------------------- | ----------------- | ----------------------- |
| 1000   | production.full.history200       | 110.79       | 51.38         | 250.79            | 315.98                  | 30.86             | 60.32                   |
| 1000   | prepared.bounded1000.concurrent4 | 508.35       | 200.82        | 243.36            | 315.98                  | 27.84             | 60.32                   |
| 10000  | production.full.history200       | 111.38       | 50.44         | 341.38            | 341.63                  | 28.49             | 60.32                   |
| 10000  | prepared.bounded1000.concurrent4 | 537.93       | 259.02        | 361.50            | 384.43                  | 26.60             | 60.32                   |
| 10000  | retrieval.meili.tagTypeTop100    | 313.55       | 151.66        | 367.30            | 384.43                  | 654.03            | 654.03                  |
| 100000 | production.full.history200       | 32.68        | 49.80         | 936.92            | 937.27                  | 616.73            | 654.03                  |
| 100000 | prepared.bounded1000.concurrent4 | 881.67       | 183.25        | 1165.62           | 1249.84                 | 616.58            | 654.03                  |
| 100000 | retrieval.meili.tagTypeTop100    | 655.89       | 396.70        | 1153.45           | 1249.84                 | 892.82            | 910.32                  |

RAM current — snapshot после batch; cgroup peak накоплен с запуска контейнера, не отдельный peak операции. Node RSS включает runtime/transpilation/input buffers; присвоить весь RSS одному request нельзя.

### 6.4. Планы и стадии

| Items  | Stage/lookup | Returned | Cumulative estimate ms | Indexes / access                             | Docs examined | Keys examined |
| ------ | ------------ | -------- | ---------------------- | -------------------------------------------- | ------------- | ------------- |
| 1000   | $cursor      | 999      | 1                      | COLLSCAN                                     | —             | —             |
| 1000   | UserItem     | 999      | 69                     | userItemUnique                               | 200           | 200           |
| 1000   | ItemBan      | 966      | 122                    | itemBanUnique                                | 1             | 1             |
| 1000   | ItemStats    | 965      | 164                    | itemStatsUnique                              | 965           | 965           |
| 1000   | TagItem      | 965      | 524                    | _id_,tagItemUnique                           | 5128          | 10546         |
| 1000   | ItemRelation | 965      | 733                    | _id_,itemRelationFirstLookup,userItemUnique  | 420           | 420           |
| 1000   | ItemRelation | 965      | 912                    | _id_,itemRelationSecondLookup,userItemUnique | 442           | 442           |
| 1000   | $sort        | 965      | 912                    | —                                            | —             | —             |
| 1000   | $facet       | 1        | 912                    | —                                            | —             | —             |
| 10000  | $cursor      | 9990     | 1                      | COLLSCAN                                     | —             | —             |
| 10000  | UserItem     | 9990     | 878                    | userItemUnique                               | 200           | 200           |
| 10000  | ItemBan      | 9957     | 1429                   | itemBanUnique                                | 10            | 10            |
| 10000  | ItemStats    | 9947     | 1856                   | itemStatsUnique                              | 9947          | 9947          |
| 10000  | TagItem      | 9947     | 5927                   | _id_,tagItemUnique                           | 52478         | 108407        |
| 10000  | ItemRelation | 9947     | 8272                   | _id_,itemRelationFirstLookup,userItemUnique  | 4000          | 4000          |
| 10000  | ItemRelation | 9947     | 10369                  | _id_,itemRelationSecondLookup,userItemUnique | 4040          | 4040          |
| 10000  | $sort        | 9947     | 10369                  | —                                            | —             | —             |
| 10000  | $facet       | 1        | 10377                  | —                                            | —             | —             |
| 100000 | $cursor      | 99900    | 11                     | COLLSCAN                                     | —             | —             |
| 100000 | UserItem     | 99900    | 9828                   | userItemUnique                               | 200           | 200           |
| 100000 | ItemBan      | 99867    | 15241                  | itemBanUnique                                | 100           | 100           |
| 100000 | ItemStats    | 99767    | 19724                  | itemStatsUnique                              | 99767         | 99767         |
| 100000 | TagItem      | 99767    | 57328                  | _id_,tagItemUnique                           | 530890        | 1090247       |
| 100000 | ItemRelation | 99767    | 77844                  | _id_,itemRelationFirstLookup,userItemUnique  | 39784         | 39784         |
| 100000 | ItemRelation | 99767    | 97270                  | _id_,itemRelationSecondLookup,userItemUnique | 40004         | 40004         |
| 100000 | $sort        | 99767    | 97411                  | —                                            | —             | —             |
| 100000 | $facet       | 1        | 97470                  | —                                            | —             | —             |

Эти числа не аддитивны. В full query основной Item начинает с COLLSCAN; foreign lookups используют реальные unique/lookup индексы. Уменьшение повторных nested lookups — отдельный выигрыш от batching, даже когда индекс уже выбран. В этом fixture sort/facet не основной источник стоимости. Для prepared1000(stage timings,10 отдельных вызовов) ниже приведены медианы wall clock независимых операций; load объединяет параллельные чтения.

| Items  | Load profile/library/features/bans ms | Source existence ms | Rank/filter/sort ms | Late20cards ms | Total ms |
| ------ | ------------------------------------- | ------------------- | ------------------- | -------------- | -------- |
| 1000   | 17.91                                 | 3.27                | 2.04                | 1.59           | 24.34    |
| 10000  | 16.67                                 | 3.29                | 1.97                | 1.11           | 22.63    |
| 100000 | 16.52                                 | 3.48                | 1.98                | 1.19           | 23.48    |

### 6.5. MongoDB и Meilisearch при одинаковом top100

| Items  | IDs equal | Returned | Mongo p50 | p95  | p99  | Meili p50 | p95  | p99  | Meili build ms |
| ------ | --------- | -------- | --------- | ---- | ---- | --------- | ---- | ---- | -------------- |
| 10000  | true      | 100      | 1.22      | 2.01 | 2.39 | 2.39      | 3.15 | 3.55 | 1387.44        |
| 100000 | true      | 100      | 1.10      | 1.71 | 2.19 | 2.59      | 3.63 | 3.97 | 9752.31        |

10000: Mongo explain returned100, examined keys100/docs100, winning plan: `{"isCached":false,"stage":"LIMIT","limitAmount":100,"inputStage":{"stage":"FETCH","filter":{"deletedAt":{"$eq":null}},"inputStage":{"stage":"IXSCAN","keyPattern":{"tagIds":1,"type":1,"ratingScore":-1,"_id":1},"indexName":"studyTagTypeRating","isMultiKey":true,"multiKeyPaths":{"tagIds":["tagIds"],"type":[],"ratingScore":[],"_id":[]},"isUnique":false,"isSparse":false,"isPartial":false,"indexVersion":2,"direction":"forward","indexBounds":{"tagIds":["[\"000000020000000000000000\", \"000000020000000000000000\"]"],"type":["[\"game\", \"game\"]"],"ratingScore":["[MaxKey, MinKey]"],"_id":["[MinKey, MaxKey]"]}}}}`.

100000: Mongo explain returned100, examined keys100/docs100, winning plan: `{"isCached":false,"stage":"LIMIT","limitAmount":100,"inputStage":{"stage":"FETCH","filter":{"deletedAt":{"$eq":null}},"inputStage":{"stage":"IXSCAN","keyPattern":{"tagIds":1,"type":1,"ratingScore":-1,"_id":1},"indexName":"studyTagTypeRating","isMultiKey":true,"multiKeyPaths":{"tagIds":["tagIds"],"type":[],"ratingScore":[],"_id":[]},"isUnique":false,"isSparse":false,"isPartial":false,"indexVersion":2,"direction":"forward","indexBounds":{"tagIds":["[\"000000020000000000000000\", \"000000020000000000000000\"]"],"type":["[\"game\", \"game\"]"],"ratingScore":["[MaxKey, MinKey]"],"_id":["[MinKey, MaxKey]"]}}}}`.

Настройки/документы разные от production site_items: отдельный study index, score при фиксированном C7. Одинаковые 100ID подтверждают сопоставимый retrieval в этом сценарии, но не text search/сложные многотеговые фильтры/embedding recall. Meili build — end-to-end task completion с polling100 ms, не чистый CPU fit. Для этого ordered retrieval новая recommendation зависимость от Meili не оправдана одной скоростью.

Фактический disk snapshot непосредственно перед cleanup (KiB, все собственные experimental DB/indexes вместе; Mongo journals/WiredTiger allocation включены, image layers отдельно):

```text
346208	/data/db
4	/data/configdb
251412	/meili_data
```

### 6.6. Обновления, совместная нагрузка и полная стоимость

| Items  | Reaction+partial-profile N | p50 ms | p95 ms | p99 ms | Prepared single-doc p95 ms | Snapshot build ms | Snapshot write ms |
| ------ | -------------------------- | ------ | ------ | ------ | -------------------------- | ----------------- | ----------------- |
| 1000   | —                          | —      | —      | —      | —                          | 24.21             | —                 |
| 10000  | 50                         | 22.25  | 25.36  | 27.78  | 1.06                       | 24.59             | 19.32             |
| 100000 | 50                         | 21.86  | 24.26  | 28.06  | 1.15                       | 25.71             | 22.51             |

Reaction benchmark выполняет настоящий partial recalculation после прямого изменения UserItem; queue wait, полная UserItem mutation transaction со Stats и HTTP здесь **не измерены**. Это не commit→recommendation freshness. Prepared single-doc update измеряет одну indexed запись, не всю каскадную синхронизацию.

| Items  | Reads/updates | Read clients | Wall ms | Read p50/p95/p99 ms | Update p95 ms | Mongo CPU ms | Node CPU ms |
| ------ | ------------- | ------------ | ------- | ------------------- | ------------- | ------------ | ----------- |
| 10000  | 100/10        | 4            | 2360.56 | 92.63/136.60/166.79 | 148.90        | 599.03       | 2968.00     |
| Items  | Reads/updates | Read clients | Wall ms | Read p50/p95/p99 ms | Update p95 ms | Mongo CPU ms | Node CPU ms |
| ---    | ---           | ---          | ---     | ---                 | ---           | ---          | ---         |
| 100000 | 100/10        | 4            | 1941.50 | 71.90/122.64/132.01 | 159.09        | 620.54       | 2813.00     |

Mixed workload реально совмещает 100 prepared1000 reads четырьмя readers и 10 прямых reaction/profile updates. Он не включает trainer/read-model rebuild одновременно с ними. Их build/fit затраты измерены отдельно: фон учитывается как отдельная полная стоимость, а не объявляется бесплатным.

| Items  | Shared build Node CPU ms | Shared build Mongo CPU ms | Образец cache break-even reads |
| ------ | ------------------------ | ------------------------- | ------------------------------ |
| 1000   | —                        | —                         | >1.06 до invalidation          |
| 10000  | 765.00                   | 191.18                    | >1.75 до invalidation          |
| 100000 | 8719.00                  | 1731.06                   | >2.19 до invalidation          |

Последний столбец — **расчёт** `n>G/(F−R)` по измеренным средним, не traffic evidence и не измерение всего cache lifecycle.1k write не измерялся отдельно, поэтому его граница — нижняя оценка. Добавить invalidation/storage/repair/shared-build amortization; после каждой реакции версия может меняться, и повторных чтений одной версии может не быть. Дневной rebuild/training и миллион inactive users нельзя оценивать как cost per active query без реального числа активных readers. Денежные цены облака не измерялись.

### 6.7. Более плотные metadata и глубокие ancestors

| Seed | Items | Tags/item | Max parent depth | Mode                        | N   | p50 ms  | p95 ms  |
| ---- | ----- | --------- | ---------------- | --------------------------- | --- | ------- | ------- |
| 29   | 1000  | 32        | 7                | production.dense.full       | 5   | 1638.66 | 1639.95 |
| 29   | 1000  | 32        | 7                | production.dense.bounded200 | 10  | 330.66  | 335.93  |

Seed29 намеренно меняет shape:32 tags/item, бинарное дерево ancestors depth7. Это отдельный stress fixture, не случайный повтор той же нагрузки.

### 6.8. Node ALS fold-in и exact topK: отдельная граница

Library parity100 реальных anime histories: folded top20=100/100, cached top20=100/100, max factor error=0.000009488834691318004, max score error=0.000002263450684436563. Independent heap oracle32 малых случаев также прошёл.

| Operation         | N    | p50 ms | p95 ms | p99 ms | Calls/s | CPU ms/call | Node RSS MiB after | ArrayBuffers MiB after |
| ----------------- | ---- | ------ | ------ | ------ | ------- | ----------- | ------------------ | ---------------------- |
| foldRealHistories | 1000 | 0.17   | 0.51   | 0.81   | 4669.1  | 0.23        | 56.86              | 11.13                  |
| top500_12294      | 200  | 1.12   | 1.48   | 1.67   | 859.7   | 1.17        | 50.77              | 4.60                   |
| foldAndTop500Real | 1000 | 1.14   | 1.58   | 1.82   | 837.1   | 1.17        | 63.52              | 4.98                   |
| top500_100000     | 200  | 14.49  | 15.25  | 15.80  | 83.3    | 11.48       | 87.51              | 29.01                  |
| top500_1000000    | 100  | 144.44 | 147.92 | 148.79 | 6.9     | 141.40      | 307.47             | 248.64                 |

12294 rows — реальные factors;100k/1Mrows реально выделены и просканированы, но повторяют этот массив с похожими/одинаковыми vectors. Это технический тест 64d/heap500/RAM, не качество миллионного каталога и не полный endpoint. Synchronous Node main-loop нельзя считать production serving: в спецификации обязателен worker pool. Очередь и многоклиентный worker-thread API здесь не реализованы/не измерены.

### 6.9. Что выявила повторная проверка и что измерено дополнительно

Старые prepared/raw/snapshot timings — фактическая стоимость выполненных статических прототипов. Они **не доказывают полностью корректный динамический serving**: prepared() запрашивал canonical карточки, но возвращал старые feature rows; rawBatch ошибочно применял чужой региональный ban; snapshot reader не восстанавливал порядок ID после Mongo `$in`. Эти дефекты не меняют сохранённые времена или static parity, но запрещают выдавать их за готовую реализацию. Исторические скрипты/JSON не переписаны.

| Диагностический случай старого prototype                        | Фактический результат |
| --------------------------------------------------------------- | --------------------- |
| Удалённый после materialization кандидат попал в prepared ответ | true                  |
| Raw batch исключил ru-ban при country=unknown                   | true                  |
| Snapshot сохранил исходный ranking order                        | false                 |

В новом изолированном functional.cjs добавлены batch canonical filters/availability/library/current ratings и final hydration. 15 сравнений с настоящим production oracle совпали (static baseline, deletion, регион/global bans, block, active/expired skip, library include/only/exclude, type/rating/tag/collection-group); отдельное удаление между ranking и late-card чтением исключено. Это узкие конкретные проверки, не доказательство всех возможных races/filters.

| Guarded1000                                    | Samples | p50 ms | p95 ms | p99 ms | Node CPU ms/100 reads |
| ---------------------------------------------- | ------- | ------ | ------ | ------ | --------------------- |
| Current-content batch scorer с canonical guard | 100     | 45.28  | 52.97  | 60.35  | 3328.00               |

Цена guard теперь включена. Это отдельный повторный fixture, а не контролируемая A/B-оценка чистого overhead относительно прежних p95; queue/HTTP/ML в этой строке отсутствуют.

**Интегрированный warm ML прототип.** warm-serving.cjs реально читает текущую UserItem историю из Mongo, выполняет bounded CF+exact-folded ALS в двух worker threads, формирует union top500, применяет canonical type/existence/ban/known-library проверки, повторно читает 20 текущих карточек и отдаёт JSON через loopback HTTP. Модель содержит 12294 настоящих anime rows;100 реальных exported positive/known histories. В техническом Mongo fixture positive записаны rating8, остальные известные пары rating=null, status=completed: это явное двоичное кодирование настоящих fit-signals/masks, не утверждение об исходных оценках/статусах и не новый quality dataset. Заголовки карточек синтетические, media пустое; нагрузка больших media payload не проверена.

Top20 точно совпал с independently exported bounded CF+folded ALS в 100/100 профилях, minimum overlap=1.000. Проверки late-delete/new-block/foreign-region/global-ban прошли: lateDeleteExcluded=true, newBlockExcluded=true, foreignRegionAllowed=true, globalBanExcluded=true. Worker startup=32.88 ms, модель загружается один раз, не на каждый request.

| HTTP clients | N   | p50 ms | p95 ms | p99 ms | Calls/s | Node+workers CPU ms/call | Mongo CPU ms/call | Process RSS MiB |
| ------------ | --- | ------ | ------ | ------ | ------- | ------------------------ | ----------------- | --------------- |
| 1            | 200 | 10.90  | 13.68  | 14.80  | 89.2    | 6.96                     | 4.33              | 208.67          |
| 4            | 200 | 18.72  | 24.74  | 27.11  | 207.7   | 7.66                     | 4.12              | 217.56          |

Времена включают worker queue, transport/JSON и Mongo checks. Процесс Node и Mongo 2 CPU/3 GiB отдельно учитываются; raw counters/individual stage observations сохранены. Это экспериментальный HTTP coordinator, **не production Nest endpoint**: нет auth/session/полного сочетания range/tag/collection filters, нет Bisky HTTP recommendation controller. Эти фильтры проверены отдельно в 15-case guard, а не как полный совместный ML сценарий. Sample200 даёт лишь ограниченную оценку хвоста, длительного soak нет. Нельзя переносить эти числа на 100k/million или большие реальные карточки.

**Post-checkpoint storage.** У той же 1000-item StudyFeature логический BSON=1230072B; после фоновых checkpoints storageSize=229376B (0.22 MiB), indexes=417792B (0.40 MiB). Старые 4096B/округлённые 0.00 MiB были ранним snapshot, а не нулевой ценой хранения. Post-checkpoint10k/100k не восстановлен; общей du недостаточно для разделения их физических затрат.

## 7. Выбор архитектуры

Выбрана **MongoDB-backed многоисточниковая двухэтапная архитектура с request-time scoring** и offline версиями collaborative моделей. Основной обязательный слой — корректность eligibility, bounded downstream work и холодный/content fallback; при пригодной собственной истории — CF+ALS либо standalone policy, выбранная по validation конкретного media scope. Это одна архитектура с явными режимами данных, а не обещание одного универсального ML-алгоритма.

| Вариант                                                | Качество / cold-start                                                                     | Скорость / ресурсы                                                      | Сложность / отказ                                        | Вывод                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Оставить полный current find                           | Exact order/total, богатые signed metadata; нет measured полного Bisky quality            | Повторные joins по всему каталогу, измеренное медленное масштабирование | Минимум новых компонентов                                | Сохранить для exact use case/functional reference, не основной короткий feed   |
| Current find с bounded IDs                             | Тот же scorer на пуле; зависит от recall генератора                                       | Уже ограничивает N, но цена кандидата остаётся высокой                  | Самое маленькое изменение                                | Полезный первый контроль, недостаточно как окончательное решение               |
| Batch raw + JS scorer                                  | Та же проверенная content semantics на тестовом пуле                                      | Большая часть выгоды без новой persistent collection                    | Нужны batch joins/словарь и parity                       | Минимальный старт; подготовку добавлять для ordered retrieval/повторной работы |
| Shared read model + bounded candidates + scoped CF/ALS | Лучшие real-data collaborative policies, content для cold; отдельные ограничения rare/new | Общая модель/данные, быстрый serving, fit/storage учтены                | Eventual catalogue refresh, model lifecycle, worker pool | **Основной выбор**                                                             |
| Полные user snapshots для всех                         | Сам алгоритм не улучшает relevance; риск staleness                                        | Быстрый hit, полный generation/update cost и inactive-user waste        | Invalidation/queue/source-generation races               | Не обязательно сейчас; lazy active cache при доказанной окупаемости            |
| Vector DB/ANN + embedding-first                        | Потенциал semantic new-item retrieval не измерен                                          | Дополнительные index/memory/recall tradeoffs                            | Новый lifecycle/infrastructure                           | Отложить до превышения exact scan бюджета/доказанного quality gain             |

Выигрыш read model не обосновывает слияние Item/TagItem/ItemStats. Сохранённый site prior уже решает прежнюю проблему пересчёта C; новой SiteStats-подсистемы не требуется. Измеренное отсутствие нужды в ANN на небольшом model не доказывает его ненужность на любом I/QPS.

Ни current content formula, ни public CF weights не являются доказанным оптимумом Bisky. Для реализации фиксируются проверяемые источники/формулы/границы ниже, а выбор media policy проходит собственный offline gate. Online A/B infrastructure, retention optimization и автоматическое переключение алгоритмов здесь не проектируются.

## 8. Техническая спецификация будущей реализации

### 8.1. Ответственность компонентов

Предлагается одна двухэтапная архитектура с заменяемыми источниками и явно разными режимами данных. Cold-start использует содержательные признаки и общий prior; при наличии пригодного interaction graph добавляются выбранные offline collaborative источники. Это не автоматическая смена алгоритмов по online-экспериментам. Конкретные политики фиксируются конфигурацией после offline release-проверки на соответствующем домене.

```text
Canonical Mongo data ──→ shared retrieval/read data
        │                         │
        ├─→ current taste profile │
        └─→ frozen fit snapshot → offline ALS / optional itemCF
                                  │
request + filters + latest user state
  → candidate sources under explicit budget
  → dedup + authoritative eligibility
  → selected scorer/fusion
  → optional validated diversity
  → late card load + final exclusions
  → short window + honest continuation state
```

| Компонент                        | Ответственность                                                              | Не владеет                                            |
| -------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| Catalogue entities               | Item/Tag/TagItem/ItemRelation/Relation и их доменные правила                 | Пользовательским ML-score                             |
| UserItem / UserTasteProfile      | Canonical reactions, явные настройки, объяснимый signed профиль              | Каталогом, общей популярностью                        |
| Recommendation read-data builder | Компактные общие retrieval/scoring данные, ancestors snapshot, watermark     | Источниками истины, пользовательскими оценками        |
| Offline trainer                  | Фиксированный training snapshot, параметры, artifacts и offline report       | HTTP, выдачей после каждой реакции                    |
| Model registry/loader            | Проверенная model version, factor mapping, readiness; last known valid model | Runtime выбором «победителя» по online feedback       |
| Candidate providers              | IDs, channel scores/ranks, model/data version, spent budget                  | Публичным total всего каталога                        |
| Request coordinator              | Filters, current user inputs, budgets, dedup, scorer, cards                  | Записью внешних данных или обучением при HTTP request |
| Worker-thread scorer             | Exact dot products/fold-in/topK на immutable factors                         | Mongo credentials, auth/collection access             |

Не создавать общий абстрактный движок всех сущностей платформы. Для будущих user/friend recommendations можно переиспользовать идею retrieval/ranking и технический worker pool; Item schema и публичный контракт не должны содержать неиспользуемые entityKind ради этого будущего.

### 8.2. Сохранение текущих данных и минимальные новые read models

Item, TagItem и ItemStats сохраняют нынешних владельцев: слияние коллекций не требуется. Источники prepared fields только canonical data; generic shared records получают обычный generated `_id` и unique semantic key/item. Новые пользовательские записи вне scoped задач не создаются.

**RecommendationItem** — производная read model, если подтверждённая ниже польза materialization нужна для общего top-by-tag/type retrieval и повторного scoring:

```text
_id: ObjectId
item: ObjectId                         unique
type: EItemType
tagIds: ObjectId[]                     только настоящие назначения
tags: [{tag, relevanceScore}]
ratingAverage: number|null
ratingsCount: integer
positiveUsersCount: integer             distinct positive users по правилу §8.3
retrievalQuality: number               coarse order при priorEpoch
priorEpoch: string
releaseDate: Date|null
sourceChangedAt: Date
builtAt: Date
dictionaryVersion: string
```

Карточки title/media/description не дублировать без необходимости: после ranking они читаются только для limit20–25. Region ban, user library, deletedAt и access проверяются в canonical collections. Optional копия deletedAt может помогать retrieval, но не является authoritative. Relation edges загружать пакетно через существующие индексы для нужных seeds/candidates; benchmark-дублирование всех relation metadata в StudyFeature не является обязательной схемой.

Индексы первой версии:

```javascript
{item:1}                                      unique
{type:1, retrievalQuality:-1, item:1}
{type:1, positiveUsersCount:-1, item:1}
{tagIds:1, type:1, retrievalQuality:-1, item:1}
{type:1, releaseDate:-1, item:1}               если включён new-item source
```

Один indexed array — tagIds; не добавлять в тот же compound index ещё один независимый array. Запросы по одному tag equality/type проверяются explain; union по нескольким тегам ограничивается по каждому источнику и дедуплицируется. Range filters требуют отдельной проверки: этот индекс не обещает ускорять все сочетания фильтров. Для более дорогих предикатов допустим post-filter/refill с объявленной неполнотой.

`retrievalQuality=(n*R+20*C_epoch)/(n+20)` — только общий порядок отбора. При изменении одного ItemStats обновляется одна prepared запись с тем же C_epoch. C_epoch фиксируется на дневной refresh или при существенном drift, предложенный порог |C−C_epoch|>=0.1; это инженерный порог, не quality optimum. Нельзя пересчитывать весь каталог после каждого изменения SiteStats. Финальный exact rating tie-break использует текущие n,R,C, загруженные пакетно; принадлежность к candidate pool уже приблизительна.

Неперсональные popularity и rating — разные источники. Для cold-start popularity определить `positiveUsersCount = count(non-skipped UserItem, удовлетворяющих positive из §8.3)`. Нельзя подменять это суммой ratingsCount/favoritesCount: аудитории пересекаются. В будущей реализации ItemStats владеет новым счётчиком и меняет его в существующей UserItem transaction на `positive(next)-positive(previous)`; read model копирует агрегат. При смене confidenceMapping производный счётчик пересобирается из UserItem, если данные существуют; пользовательские записи не мигрируются. Model serving использует frozen training popularity для измеренного tie-fill; текущая popularity — отдельный cold fallback. Без собственных positive популярность неинформативна: использовать действительный rating prior/явные настройки и нейтральный порядок, не выдуманные голоса. Новое поле/индекс — проект спецификации; их стоимость не измерялась.

**Tag graph cache**: immutable map `{tag → group, type applicability, significance, ancestors[]}`, dictionaryVersion. Хранить один snapshot в MongoDB (разбить на chunks при приближении к 16 MiB document limit) либо получать из Tag на worker startup; в RAM переиспользовать. Не копировать весь ancestors каждой assignment как обязательное правило. DAG closure строится по настоящим parents, visited-set, проверка циклов; новый невалидный snapshot не публикуется. Персональное подавление применяется после known/applicable/assigned пересечения. При смене parents/modifiers публикуется новый dictionaryVersion; scoring одного запроса использует одну версию.

**RecommendationModel** и factor chunks (нужны при включении CF):

```text
Model: _id, key(scope+version), algorithm, mediaScope,
       sourceSnapshot, trainedAt, trainingCutoff,
       dimensions, confidenceMapping, regularization, seed,
       itemMappingHash, artifactHashes, metrics, state
Chunks: _id, model, part, binaryPayload; unique(model,part)
```

Использовать Mongo binary chunks/GridFS, существующий S3 только если удобнее deploy; преимуществ отдельного model service не установлено. Item factor matrix и ID↔row mapping загружаются один раз в immutable RAM/SharedArrayBuffer. Не делать тысячи Mongo reads за факторами на каждый запрос. Для fold-in нужны item factors и YᵀY; user factors всех зарегистрированных пользователей в serving хранить необязательно. Оценки/история читаются из UserItem. Optional cache user vector привязан к input fingerprint+model version; stale vector не используется после новой реакции.

**RecommendationNeighbors** — только если выбран ItemCF или CF+ALS:

```text
_id, model, item, neighbors:[{item, similarity}]; unique(model,item)
```

Максимум 100 соседей в проверенном варианте. Не раскрывать raw user IDs в подготовленном item graph. Sparse touched-neighbor scoring дополняется тем же popularity tie-fill, который реально участвовал в benchmark. Без этого measured top500 candidate recall не переносится.

Персональная коллекция готовых выдач не обязательна сейчас. Она добавляется только после измеренного соотношения повторных чтений и новых реакций; её стоимость и stale-publication протокол описаны отдельно.

### 8.3. Сигналы и профиль

Объяснимый UserTasteProfile сохраняет текущую формулу, semantic tags и явные overrides. Не менять coefficients на основании слабого genre-only ablation. Низкая оценка — signed taste, block — candidate exclusion, skip — временное candidate exclusion и отсутствие taste contribution. Отсутствие события, покупка, завершение и время игры не превращаются в dislike/like автоматически. Если позже вводится отдельный quick like, его отображение в canonical rating/favorite или отдельный signal согласовывается отдельным контрактом; исследование его не выдумывает.

ALS training/inference первой проверенной модели использует только положительные сигналы, confidence mapping versioned. Для Bisky стартовое предложение: `positive=(rating>=8) OR (isFavorite AND (rating==null OR rating>=5))`; rating1–4 всегда не positive; один user-item positive=1. Skipped исключается, retained rating/favorite blocked-записи сохраняют текущую content-семантику и предложенное соответствие CF, но сам blocked Item не выдаётся. Это отличается от непрерывной шкалы content-профиля и требует собственной offline-проверки. Оценка 7 без favorite сохраняет content contribution, но не становится сильным collaborative positive. Unknown/missing имеет p0,c1. Explicit-negative ALS — отдельный ablation, не подразумевается current positive-only Node fold-in.

В первой реализации достаточно current state UserItem; не создавать полноценную продуктовую аналитику. Сохранять будущую дату изменения именно вкусового сигнала отдельно от updatedAt, только если она нужна выбранной recency-политике. Не восстанавливать несуществующую историю и не запускать mandatory backfill. Без журнала прошлых состояний не обещать честный historical replay.

**Реакция на новый input**: hard exclusion применяется при следующем чтении непосредственно из canonical state. User factor можно пересчитать из актуальных positives при запросе в worker; новое действие не требует полного ALS retrain. Content profile остаётся eventual-consistent через worker. Предложенная цель здоровой очереди — p95 commit→profile publish<=5s, но в этом исследовании очередь целиком не измерялась. При нарушении freshness budget active user запускает ограниченный repair; ответ не должен утверждать, что весь вкус уже обновлён.

Не добавлять recency decay поверх current weight/count: агрегат не содержит возраст отдельных вкладов. Быстрая смена вкуса в полноценной длинной истории остаётся ограничением stationary ALS/content. Предусмотреть текущие explicit preferences и возможность будущего bounded session overlay на настоящих новых событиях; коэффициенты decay/session без real data не объявляются выбранными.

### 8.4. Candidate generation

Scope запроса сначала задаёт разрешённые Item types, фильтры и права collection. Cross-media collaborative модель не обучается соединением несвязанных public users. Для первых Bisky-моделей scope разделяется по целевому домену; общие канонические content tags могут использовать весь разрешённый профиль.

Начальные исполнимые budgets — инженерное предложение:

| Работа                              |                                       Стартовый предел | При достижении                                                       |
| ----------------------------------- | -----------------------------------------------------: | -------------------------------------------------------------------- |
| Итоговый unique candidate pool      |                                                   2000 | Детерминированный merge; не заявлять global exhaustiveness           |
| Collaborative top candidates/source |                                    500, refill до 1000 | Сохранять candidate recall и качество, сравнивать на validation      |
| Content retrieval                   |          До 8 положительных/explicit tags,100/type/tag | Дедуп; негативы не генерируют positive candidates                    |
| Общий fallback                      |                                               200/type | Train-only/current permitted aggregate, не snapshot test popularity  |
| New-item channel                    |                                                 До 100 | Только валидные metadata, нет выдуманного CF score                   |
| Relation channel                    |           До 50 positive seeds ×20 edges, максимум 500 | Измерять потери; exact bonus не равен exact retrieval                |
| Refill passes                       |                  До 3, максимум 4000 просмотренных IDs | Возвращать меньше Items/continuation, а не ложное «каталог кончился» |
| Window                              | 20 по умолчанию; Пик максимум 25 по продуктовой основе | Повторы исключаются IDs потребителя                                  |

Число 2000 больше измеренного coarse e2e1000 и не выдаётся за достигнутый SLO: будущая реализация обязана проверить его. Defaults500/1000 ориентированы на фактически измеренные candidate ablation; release gate — качество после truncation, а не сама круглая цифра.

ALS retrieval до проверенного model-size бюджета использует exact factor scan в worker thread: dot products для scope, mask известных/недоступных rows, min-heap topK. Это O(I*d) retrieval, **не bounded по размеру каталога**; bounded downstream pool ограничивает eligibility/ranking/cards. Эти две цены разделены. При превышении measured scan/queue budget использовать last valid общие/content кандидаты, фиксировать degraded request; не блокировать Node event loop. Перейти на ANN или подготовленные active-user pools только после отдельного recall/cost сравнения. Простое увеличение cap не решает throughput.

ItemCF retrieval читает не более 100 neighbors каждого используемого positive seed; ограничение числа history seeds, если оно понадобится, должно отдельно сравниваться с all-history quality. Нынешние offline результаты используют всю fit history. Вводить незаметный cap50 вместо полной истории нельзя. Library/input read свыше предложенных 2 MiB либо 5000 positive IDs переводит запрос в ограниченный fallback и очередь repair, без обещания той же quality; эти эксплуатационные guards не измерены на реальных power users.

Для content холодного Item канал использует только настоящие назначенные теги. До появления нового Item в CF model не придумывать вектор из случайных чисел. ALS zero-factor scores не являются отрицательной оценкой качества нового произведения. Вопрос распределения внимания новинкам требует проверки; обязательная фиксированная exploration quota не утверждается.

### 8.5. Ranking и повторное ранжирование

Scorer policy определяется scope/config, а не изменяется автоматически по online reward. Возможные проверенные policies: current content score, standalone ALS, ItemCF(+pop-fill), CF+ALS RRF. Выбор по validation; test используется один раз для оценки выбранной конфигурации. Источники с разными шкалами нельзя просто складывать как calibrated probabilities.

Очень короткая история требует отдельного режима: в точечных оценках всех трёх artificial-history ablations после одного positive CF/ALS уступили popularity; coarse genres ещё слабее. Отдельные paired CI для h1 не рассчитывались, поэтому это не статистически доказанный универсальный порог. Предлагаемый старт до собственной cohort-validation: **0–4 positives без explicit taste → prior/popularity base**, без принудительной CF-персонализации. Порог 5 — осторожный инженерный default, не найденный universal optimum: h2–4 не измерялись, а VNDBh5 gain мал. Explicit taste/filters сохраняются и могут включать отдельный content-путь; они не игнорируются ради public popularity metric. Наличие общей обученной модели не означает полезность CF сразу после одного like. При 5+ positives включать выбранную collaborative policy только при пригодной модели и положительном own-domain offline gate; без модели content остаётся возможностью, а не доказанным превосходством над prior.

Проверенная форма RRF:

```text
fusion(u,i) = a*I(i in CF500)/(60+rank_CF500(u,i))
              + (1-a)*I(i in other500)/(60+rank_other500(u,i))
absent source contribution = 0
```

Other в исходном anime эксперименте — signed content, в Steam/VNDB — ALS; эти результаты называются раздельно. Поддерживать a=0/1 как самостоятельные модели, чтобы слабый источник не был обязательным. Для реализации выбрана bounded формула: предмет только в одном списке не получает неизвестный полный ранг второго источника; вне обоих пулов он не участвует. Исторический benchmark использовал полные ранги вне top500 и отдельно перепроверен bounded-протоколом на seed17 всех трёх datasets (§5). Нулевые CF scores имеют train-popularity/ID tie order.

Current content fallback: точные p_t/ancestor suppression/formula из §2; prepared inputs не меняют её. ALS final score для Items с model vector — xᵀy; new/no-model Items идут через content fallback. Их общей шкалы нет. Для первой версии без собственного validated гибрида не заявлять глобально оптимальный mixed порядок: cold-only requests ранжируются content; warm collaborative policy ранжирует свой пул, а дополнительные cold/content каналы подключаются только с явно выбранной offline fusion policy. Спецификация предусматривает обработку нового Item, но равномерное распределение его показов без отдельной политики не гарантируется.

Planned/relation bonuses текущего exact find сохраняются. В новой collaborative ленте механическое умножение ALS/RRF на эти бонусы — новая модель, которой нет в benchmark. Начальная рекомендация: отдельные candidate channels, hard invariants, deterministic tie-break; product boost включать после ablation. Для Пика planned и остальные библиотечные статусы исключаются, поэтому plannedBoost не нужен. Семантические next-season prerequisites не выводятся из franchise membership.

Diversity: вначале удалять только один и тот же Item/явные альтернативные дубли в соответствии с каноническим каталогом. Семантически похожие разные Items не hard-ban. MMR/франшизный cap допускаются как optional reranker после validation заданной потери качества. Не запускать mandatory λ=.8 только потому, что один exploratory test дал красивую diversity. Legacy content ties сохраняют ratingScore desc/Item._id. ML policies для переноса измеренных метрик используют fit-popularity desc/Item._id после равного model score. Node heap prototype разрешает точные ties только ItemID:100 проверенных top20 совпали, но future ML integration должна воспроизвести benchmark pop tie-fill, особенно для нулевых scores. Seed для любой будущей случайности явно фиксировать.

### 8.6. Формулы ALS fold-in и serving

Положительная библиотека пользователя S, factors Y, confidence c=alpha*value:

```text
A = YᵀY + lambda*Identity + sum_{i in S}(c_i-1)*y_i*y_iᵀ
b = sum_{i in S} c_i*y_i
x = solveSPD(A,b)
score(i) = xᵀy_i
```

Для checked positive-only semantics это совпадает с `implicit.recalculate_user`; решать Cholesky с защитой finite/SPD, одинаковыми factor/model versions. Ошибка загрузки/checksum/SPD → last valid model либо content fallback, без выдачи NaN. Stored fitted user factors и exact fold-in не обязаны совпадать из-за CG и последнего обновления item factors; quality пересчитанного вектора оценивается отдельно. Результаты parity100 профилей — математическая проверка implementation, не полное доказательство качества/интеграции.

Worker pool: начать с 2 threads, bounded queue8 requests; shared immutable factor arrays, один pinned model на request. Proposed scan/fold budget100 ms CPU/request до 100k model rows; для большего размера применять фактическую измеренную границу, не молчаливую линейную экстраполяцию. Queue timeout100 ms, общий proposed service budget500 ms. Эти пределы требуют нагрузочной проверки будущего endpoint; измеренный synchronous loop нельзя переносить на main event loop.

### 8.7. Обновления, jobs и согласованность

| Производные данные | Trigger                                                                | Предложенная периодичность/бюджет                                                         | Владелец                         |
| ------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| Content профиль    | Rating/favorite/skipped/explicit; отдельно catalogue taste inputs ниже | User changes coalesce, healthy p95<=5s как цель; catalogue repair отдельный бюджет        | UserTasteProfile use case        |
| RecommendationItem | Item/TagItem/ItemStats changes                                         | Idempotent item job, healthy<=30s                                                         | Recommendation read-data builder |
| Tag closure/cache  | parents/group/significance changes                                     | Один versioned rebuild; daily03:00 modifier job reuse                                     | Tag/read-data builder            |
| New-item retrieval | Catalogue publish                                                      | <=30s при здоровом builder                                                                | Read-data builder                |
| Quality priorEpoch | Daily, либо drift>=0.1                                                 | Bounded full refresh, старый epoch допустим retrieval                                     | Read-data builder/SiteStats      |
| ALS / ItemCF       | При появлении пригодной истории                                        | Первоначально ежедневно для активного scope, максимум 30min/fit и 4 GiB trainer как guard | Offline job                      |
| Reconciliation     | Пропущенные jobs/неактивность scheduler                                | Для active users lazy; read-data sweep раз 30min с watermark                              | Existing scheduler/jobs          |

Это targets, не измеренные guaranteed SLA. Перенос полного расчёта в background не уменьшает его стоимость. Training запускается только при изменившемся source snapshot; не тренировать пустую модель ежедневно ради cron. Не вычислять персональные списки для всех неактивных пользователей.

Очередь остаётся BullMQ существующего JobsModule. Coalescing key для общих Item rebuild — item ID; для model scope — scope+algorithm. `keepLastIfActive` означает follow-up и не служит cancellation/version check. Shared read-data можно eventual-consistent: запись idempotent, периодический sweep исправляет missed enqueue. Перед ответом canonical eligibility не доверяет этому lag.

Для user-derived публикаций, которые должны считаться поколением, нужен конкретный source guard. Минимальное предложение при введении персонального cache/ALS-vector cache: `User.recommendationInputRevision` увеличивается в той же Mongo transaction, что relevant input; builder фиксирует coherent input snapshot и его revision; cache/model-user result публикуется лишь если revision не изменился. Partial tag jobs не должны автоматически писать «обработана вся текущая revision»: для такого watermark нужен объединённый per-user rebuild либо учёт всех pending inputs. CAS нынешнего массива и keepLastIfActive не заменяют это условие.

Если вводится durable freshness watermark, выбранный протокол — coalesced per-user **полный** rebuild, владелец один; нынешние partial jobs не пишут общий appliedRevision и не продолжают конкурировать за calculated profile после переключения владельца. Rebuild читает User revision, UserItem и explicit preferences в одной короткой Mongo snapshot transaction, вычисляет результат вне transaction. Publish — отдельная transaction: conditional **write** в тот же User `{_id, recommendationInputRevision:captured}`, `$set:{recommendationAppliedRevision:captured}`, `$inc:{recommendationPublication:1}`, затем запись профиля/optional buffer с captured revision. Если условие не совпало либо write conflict — transaction откатывается, результат отбрасывается и coalesced job повторяется. Именно write User создаёт конфликт с concurrent input transaction; просто read User и write Profile недостаточно. Входящие explicit updates также увеличивают inputRevision в своей transaction.

Recovery scheduler находит User с `recommendationInputRevision>recommendationAppliedRevision`; marker меняется атомарно с source mutation и остаётся видимым при потере enqueue. Перед внедрением измерить full rebuild against current partial updater; current direct-update measurements ниже относятся к partial updater. До включения этого протокола профиль честно eventual-consistent, без claims общей appliedRevision. Никакого event history/универсального revision framework этот marker не создаёт.

**Catalogue-driven profile repair выбран отдельно.** Изменение/удаление TagItem, relevance, Item.deletedAt/type, применимости/группы Tag меняет рассчитанный вкус даже без нового UserItem. Владелец catalogue mutation сообщает Item ID; при Tag applicability change — затронутые TagItem.item. UserTasteProfile repair coordinator перечисляет затронутых rated/favorite пользователей через существующий индекс UserItem(item,user), страницами 1000, и coalesce full-profile rebuild по user. Удаление назначения не теряет старые теги, поскольку full rebuild читает всю текущую библиотеку. Это не пересчёт всех пользователей на каждый rating и не блокирующий fanout в catalogue transaction.

Защита от missed catalogue enqueue — lazy repair при чтении профиля старше предложенных 30min от его **input snapshot time**; обновление user signal использует свой более строгий revision path. При первом чтении старого профиля enqueue repair, применять актуальную eligibility и не объявлять вкус актуальным по каталогу. Неактивных пользователей заранее не пересчитывать. Event fanout ускоряет обычный случай, periodic/lazy rebuild восстанавливает случай потери события; максимальное wall-clock время очереди при outage не гарантируется. `recommendationAppliedRevision` подтверждает только user inputs, не отсутствие catalogue изменений; источник snapshot и catalogueComputedAt сохраняются в профиле отдельно. Tag.weightModifier/parents меняют request-time significance/suppression и dictionaryVersion; сами weight/count не требуют пересчёта, пока назначение/relevance/применимость прежние.

Model publication: immutable artifacts + checksums + complete state, затем atomic head switch при sourceSnapshot/generation не старше текущего head. Неудачный fit оставляет last valid model. Новая модель не мутирует массивы выполняющегося запроса; старые shared arrays освобождаются после readers. Смешивание factor rows/mapping/YᵀY разных versions запрещено.

### 8.8. Фильтры, ошибки и выдача

Публичный endpoint в исследовании не добавляется. Следующий агент сначала согласует его HTTP-контракт согласно apps/api/AGENTS.md. Предлагаемый внутренний результат короткого окна:

```text
items: current cards + internal score explanation
continuation: opaque candidate-state token | null
hasMoreCandidates: boolean
isComplete: boolean
```

`total` всего каталога отсутствует. `isComplete` означает только объявленную область текущего generation; при bounded early stop нельзя выставлять «весь каталог исчерпан». При лимите работы — continuation/degraded partial result, а не fabricated empty-catalog message. Не переносить repository direction asc на приблизительную feed как «точный reverse глобальной relevance».

Перед ответом пакетно перепроверяются Item существование/deletedAt, type, raw ranges, exact tags, collection authorization/membership, library include/only/exclude, explicit exclusions, ItemBan/current country и active skip expiry. IDs после устаревшего cache не считаются доступными автоматически. Final card load может удалить ещё исчезнувшие Items; bounded refill или меньший ответ. Eligibility соответствует последнему завершённому чтению; конкурентные изменения после него не превращаются в обещание linearizable response.

Возрастная метка сама по себе не определяет consent пользователя: текущая User schema не имеет такого подтверждённого контракта. Не изобретать возрастной consent field/юридическую политику в рекомендационном исследовании. Применять существующие country/age/query правила; новые требования доступа согласовать отдельно.

Missing read model/model: batch canonical fallback на bounded candidates; нет пригодной персонализации — неперсональный разрешённый список. Redis/worker/model outage не должен отключать чтение canonical библиотеки. При невозможности проверить hard restrictions запрос завершается ошибкой/пустой безопасной проверенной частью, а не выдаёт unchecked Items. Не возвращать stack traces, raw profile или чужие user data.

### 8.9. Cache и окупаемость

По умолчанию переиспользуются общие immutable factors/dictionary и prepared catalogue data. Персональную полную выдачу не генерировать после каждого изменения для всех пользователей. Request-scoped вычисления дешевы и не создают stale publication race при каждом feed read.

Если позднее вводится короткий active-user buffer: generated `_id`, unique `(user, normalizedRequestHash)`, ordered IDs/scores<=200, inputRevision, modelVersion, dictionaryVersion, builtAt, expiresAt. Предложенный TTL60s, hard recheck на каждом чтении, явная invalidation на reaction/library/filter context. При hydration собрать Map(itemId→currentCard), затем пройти исходный ordered ID list; Mongo `$in` не сохраняет ranking order. Старый snapshot-прототип этого не делал (§6.9). Job capture/publication guard из§8.7 обязателен; отмена необязательна, но stale result нельзя опубликовать. Удаление/ban проверяются независимо от cache-key.

Считать полную стоимость за интервал: reads*r + generation*g + invalidations*u + shared-build-amortization. Cache окупается относительно request compute F при `reads*(F-R) > G+U`; подставлять измеренный **дешёвый новый путь**, а не только дорогой старый full scan. Не объявлять перенос полного обхода в фон снижением CPU. Предлагаемый trigger внедрения — наблюдаемое повторное чтение одной версии≥измеренной точки окупаемости и недостаточность request-time latency/CPU; сейчас такого Bisky traffic evidence нет.

### 8.10. Масштабирование и дальнейшее развитие

Разделять U,I,nnz, длину истории и число активных readers. Число зарегистрированных пользователей не увеличивает per-read стоимость shared item factor scan напрямую; nnz влияет на fit, H — на fold-in, concurrency — на очередь/CPU. UserItem lookup indexes измерены, но 100 users/10kusers — не миллион.

Расчётные нижние границы, **не measurements**:

- Float32 ALS 64 при U=I=1M: `4*64*(U+I)=512MB` только vectors. Serving без persisted user vectors —256MB item factors. Mapping, masks, workers и dataset добавляются.
- CSR50M binary positives: около`8*50M +4*(U+1)=404MB` при uint32 indices/float32 values; конкретная библиотека может использовать другие widths/copies. Trainer RSS существенно выше.
- ItemCF 100 на 1M Items:100M edges,800MB только uint32+float32, BSON/indexes больше. Обычный XᵀX может резко вырасти из-за длинных историй; прямое построение полного dense графа не допускается.
- Dense EASE100k:40GB float32 в одной матрице;1M:4TB, без inverse/workspace. Поэтому он не выбран как global architecture.

Ни одно из этих выражений не является прогнозом времени ответа. Факторный scan на 1M измеряется отдельно от полноценного Mongo/HTTP load. Если точный scan перестаёт укладываться в budget, следующий эксперимент — ANN с filtered recall и с той же test quality, либо generation только для активных пользователей. Выбор конкретного vector engine и новая инфраструктура сейчас не обязательны.

Классификация:

| Необходимо сейчас                                                                                                                                                       | Предусмотреть архитектурно                                                                                                                  | Отложить                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Разделённые exact-find/feed contracts; строгая eligibility; bounded downstream; content/cold fallback; train-only baselines; batch/read-data optimization по измерениям | Offline ALS и optional ItemCF providers с immutable versioned artifacts, worker-thread API, media-scoped policy, candidate recall reporting | Online switching, A/B platform, retention optimizer, LTR/sequence/GCN/LLM ranker                     |
| Источники истины Mongo; recovery/freshness явно определены; маленькие service budgets                                                                                   | Active-user buffer при окупаемости, session/recency из настоящих событий, metadata-aware hybrid, ANN при превышении scan budget             | Миллион заранее рассчитанных user feeds, vector DB без benchmark, generic recommender всех сущностей |

Если собственная Bisky history уже достаточна к моменту реализации, ALS/CF этап становится частью первого полноценного релиза после offline gate. Если истории нет, реализация не должна создавать видимость обученной персонализации: content и явные настройки — честный bootstrap.

## 9. Этапы реализации и критерии приёмки

### 9.1. Последовательность будущей реализации

1. **Развести use cases и бюджеты.** Сохранить нынешний exact find/filters/library semantics. Согласовать отдельный feed endpoint/continuation contract; это исследование не утверждает HTTP-операцию как реализованную. Добавить измерение candidate count, stage/total latency, queue wait и fallback reason в существующие структурированные логи; полную аналитику не строить.
2. **Сначала минимальный быстрый путь.** Ограниченный candidate provider плюс batch canonical loading и персональный scoring с parity нынешнего scorer. Сравнить с `find(candidateItemIds)`. Prepared RecommendationItem включать для обоснованного общего ordered retrieval/повторных чтений, сохраняя нормализованные canonical entities. Не переносить prototype-дублирование карточек и всех relation edges автоматически.
3. **Свежесть.** Явно определить triggers от Item/TagItem/parents/modifiers/ratings/library, repair после missed enqueue, canonical final checks. Покрыть удаление старого тега. Если вводятся generation watermarks/personal buffers, сначала coherent source revision protocol; иначе честная eventual consistency.
4. **Cold-start релиз.** Доступные настоящие metadata, явные настройки, current content formula и общий fallback. Не выдавать public pretrained factors без mapping/own-history за рабочий CF Bisky. Отдельно проверить редкие filters и new-item retrieval.
5. **Collaborative этап.** Экспортировать frozen собственные user-item данные, запустить те же baseline/ALS/ItemCF/fusion протоколы, выбрать media policy по validation и единожды оценить test. Публиковать immutable model artifacts. Подключить positive-only ALS fold-in и worker-thread retrieval; ItemCF только в policies с измеренным преимуществом. Проверить cached/folded quality, all-history masking/pop-fill.
6. **Оптимизации по факту.** Разнообразие, персональный buffer, ANN, content embeddings и recency — только после соответствующего quality/cost эксперимента. Накопление данных не является автоматическим приказом добавить каждую технологию.

Проект в разработке: переход — замена внутреннего пути/добавление согласованного use case и пересборка производных данных. Не требуется перенос несуществующих production recommendation snapshots, legacy-format compatibility или mandatory backfill. Canonical пользовательские записи и explicit preferences сохраняются. Rollback — конфигурация прежнего exact/content пути; новые derived artifacts можно перестроить, не удаляя user data.

### 9.2. Проверяемые критерии

Это предложенные release gates, а не исторически утверждённые SLO:

| Область         | Критерий                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Контракт        | Exact find сохраняет total/order/filters/library, feed не обещает их на ограниченном пуле                                                                                       |
| Eligibility     | Ноль известных нарушений deleted/ban/country/active-skip/block/library/collection/exclude в фиксированных сценариях и конкурентных обновлениях                                  |
| Формулы         | Exact content path совпадает с production oracle по IDs и scores до 1e-10; hierarchy known-child suppression не меняется                                                        |
| ALS             | 100 реальных exported profiles: factor max error<=1e-4, top20 equality при одинаковых inputs/ties; отрицательные inputs только при отдельной поддержке и проверке               |
| Quality         | На собственной fixed full-catalog test выборке выбранная policy лучше popularity по NDCG@20; paired95% CI; не хуже лучшего одиночного baseline сверх заранее выбранного допуска |
| Retrieval       | Candidate recall и final Recall/NDCG отдельно; при bounded rerank целевой retention>=95% NDCG reference и>=95% top20 retrieval overlap либо явно принятый tradeoff              |
| Когорты         | Публикуются history0/1/5/long, popular/tail/zero-train/new; aggregate improvement не скрывает нулевой tail recall                                                               |
| Latency         | На повторённой конфигурации 2 CPU/3 GiB: предложенная feed p95<=250 ms на 10k/4 clients, p95<=500 ms на 100k/4 clients;>=1000 samples перед p99 выводами                        |
| CPU/Background  | Суммарные query/update/build CPU на 1000 reads+100 reactions и shared refresh; fit/refresh не нарушает foreground budget                                                        |
| Freshness       | Предложенные профиль 5s/read model30s healthy p95 проверяются commit→visible отдельно от исполнения handler; queue outage/recovery отдельно                                     |
| Memory/model    | Model mapping/hash/version coherent, bounded worker queue, last valid fallback; реальные RSS/cgroup/disk, не только factor-size formula                                         |
| Race            | Новая reaction при generation не допускает публикации помеченного свежим устаревшего результата; delayed active job не перезаписывает новую version                             |
| Ошибки          | Пропущенный enqueue, failed fit, partial model load, stale cards/bans и exhausted refill имеют воспроизводимое поведение                                                        |
| Reproducibility | Dataset/version/hash, split/seed, params, per-user deltas и сырые observations сохраняются вне main production code                                                             |

Допуск 95% для approximate retrieval — авторский инженерный gate, не результат данного исследования и не обязательное требование Bisky. Если candidate budgets не проходят, сначала увеличивать/менять sources по измеренному recall; не компенсировать потерю только более сложным scorer. Для narrow filters повторить quality/candidate evaluation на разрешённом каталоге: full-catalog метрики широкого запроса не дают этой гарантии.

## 10. Воспроизведение и состояние проекта

### 10.1. Артефакты

Пути `.temp/...` и `apps/api/...` в тексте и команды воспроизведения ниже отсчитываются от корня репозитория, если явно не указан другой рабочий каталог. Исторические пути в протоколах сохранены.

Все исследовательские файлы находятся в игнорируемом [`.temp/bisky-study-20261101/`](../../../../../.temp/bisky-study-20261101/) вне production-кода. Постоянный Git-результат — этот Markdown. Локальный `reproducibility.zip` содержит скрипты, протоколы, aggregate results, source evidence и manifests; raw пользовательские datasets/factors/per-user exports в Git не добавлены. Полные data/latencies сохранены локально по указанным путям; обновлённый локальный zip содержит также compressed snapshots, selected data, factor arrays и per-user NPZ; внешний checkout/runtime/API dependencies нужны отдельно.

Основные файлы:

| Путь внутри каталога исследования                       | Содержание                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| initial-hashes.json / initial-state.json                | Исходный HEAD/status/hashes                                                |
| loader.cjs / performance.cjs                            | Прямой запуск настоящего production scorer, seeding, alternatives, explain |
| performance-<N>-<seed>.json                             | Все latency observations, counters, plans, build/storage/parity            |
| vector-serving.cjs / vector-serving.json                | Node fold-in/topK parity и scale measurements                              |
| quality/prepare.py / benchmark.py                       | Подготовка и основные quality experiments                                  |
| quality/*-17.json, *-29.json, *-43.json                 | Final metrics/params/paired intervals по фактически выполненным runs       |
| quality/*-serving.json / serving.py                     | Real implicit library serving,1000 samples/operation                       |
| quality/_cold_.json и ablation scripts                  | Укороченные реальные истории и новые Items                                 |
| quality/*-per-user.npz                                  | Парные per-user metrics, не включены в Git                                 |
| quality/dataset-stats.json / runtime.json               | Реальные размеры/распределения/hashes/versions/BLAS                        |
| quality/superseded/                                     | Невалидный первый VNDB run с причиной; не входит в итоговые таблицы        |
| quality-review.md / code-audit.md / literature.md       | Независимые статические проверки и источники                               |
| vndb-*.pl / *.pm / _README_                             | Зафиксированные официальные format/license/date semantics                  |
| verification.json / final-integrity.json / cleanup.json | Фактически выполненные проверки, исходные hashes и cleanup                 |

Исследовательские scripts не являются готовым production-кодом. Они пишут только prefixed experimental DBs; повторный seed существующей DB отклоняется. Не запускать cleanup против пользовательских БД. Протокол намеренно не обращается к `.env`.

### 10.2. Подготовка и полный quality-маршрут

Распаковать содержимое reproducibility.zip в `.temp/bisky-study-20261101` относительно checkout dc829701ca0c630d2784117684e85a041c36922d. Установленные API dependencies должны соответствовать pnpm-lock.yaml. ZIP не является автономным запуском вне исходного repo.

```powershell
$studyRoot = Join-Path (Get-Location) '.temp/bisky-study-20261101'
$studyPython = 'C:\Users\vanya\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $studyPython -m pip install --target "$studyRoot/quality/deps" --no-deps scipy==1.18.1 implicit==0.7.3 threadpoolctl==3.7.0 tqdm==4.70.1
& $studyPython "$studyRoot/quality/download.py"
& $studyPython "$studyRoot/quality/prepare.py"
```

Эта dependency команда предполагает bundled NumPy 2.3.5/pandas 3.0.1 и их уже установленные транзитивные зависимости; для чистого Python они также нужны. download.py проверяет SHA256 и распаковывает zip. Dated VNDB URL может исчезнуть: при наличии локального исходного `.gz` download.py использует его и проверяет hash, при отсутствии точный historical dataset не гарантирован.

#### Семь основных quality runs и дальнейшие ablations

Прозрачный expanded маршрут без повторного выполнения трёх seeds из run_final:

```powershell
& $studyPython "$studyRoot/quality/benchmark.py" --dataset anime --seed 17
& $studyPython "$studyRoot/quality/benchmark.py" --dataset anime --seed 29
& $studyPython "$studyRoot/quality/benchmark.py" --dataset anime --seed 43
& $studyPython "$studyRoot/quality/benchmark.py" --dataset steam --seed 17
& $studyPython "$studyRoot/quality/benchmark.py" --dataset steam --seed 29
& $studyPython "$studyRoot/quality/benchmark.py" --dataset steam --seed 43
& $studyPython "$studyRoot/quality/benchmark.py" --dataset vndb --seed 17
& $studyPython "$studyRoot/quality/serving.py" --dataset anime
& $studyPython "$studyRoot/quality/collaborative_hybrid.py"
& $studyPython "$studyRoot/quality/fold_quality.py" --dataset anime
& $studyPython "$studyRoot/quality/fold_quality.py" --dataset steam
& $studyPython "$studyRoot/quality/negative_feedback.py"
& $studyPython "$studyRoot/quality/benchmark.py" --dataset anime --seed 17 --cold
& $studyPython "$studyRoot/quality/benchmark.py" --dataset steam --seed 17 --cold
& $studyPython "$studyRoot/quality/benchmark.py" --dataset vndb --seed 17 --cold
& $studyPython "$studyRoot/quality/cold_items.py"
& $studyPython "$studyRoot/quality/rerank.py" --dataset anime
& $studyPython "$studyRoot/quality/rerank.py" --dataset steam
& $studyPython "$studyRoot/quality/rerank.py" --dataset vndb
& $studyPython "$studyRoot/quality/serving.py" --dataset steam
& $studyPython "$studyRoot/quality/serving.py" --dataset vndb
& $studyPython "$studyRoot/quality/verify_metrics.py"
& $studyPython "$studyRoot/quality/normalize_metadata.py"
& $studyPython "$studyRoot/quality/render_results.py"
& $studyPython "$studyRoot/quality/render_final_section.py"
node "$studyRoot/vector-serving.cjs"
```

Более короткая историческая batch-последовательность: подготовка→anime17/anime29/Steam17/correctedVNDB17→serving anime→`run_final.py`→Node vector-serving. run_final сам запускает Steam29/43,anime43 и все перечисленные дополнительные jobs. Если перед ним уже выполнены все 7base runs, эти 3 будут повторены и их files overwritten; это не утрата алгоритмической воспроизводимости, но RSS/latency будут новыми измерениями. Original invalid VNDB17 не требуется воспроизводить как полезный результат.

### 10.3. Фактически выполненные performance modes

Восстановленный порядок сохраняет inputs: production/parity/retrieval до updates, mixed после updates. Sequential quality и technical runs не совмещать.

```powershell
docker run -d --name bisky-study-20261101-mongo --label bisky.study=20261101 --cpus=2 --memory=3g -p 127.0.0.1:27191:27017 mongo:8.0.17 --bind_ip_all --wiredTigerCacheSizeGB 1
docker run -d --name bisky-study-20261101-meili --label bisky.study=20261101 --cpus=2 --memory=2g -p 127.0.0.1:27791:7700 -e MEILI_ENV=development -e MEILI_NO_ANALYTICS=true getmeili/meilisearch:v1.12.8

foreach ($studyMode in @('seed','production','build','alternatives')) {
  node "$studyRoot/performance.cjs" $studyMode 1000 17
}
foreach ($studyMode in @('seed','production','build','alternatives','retrieval','updates')) {
  node "$studyRoot/performance.cjs" $studyMode 10000 17
}
foreach ($studyMode in @('seed','production','build','alternatives','retrieval','updates','mixed')) {
  node "$studyRoot/performance.cjs" $studyMode 100000 17
}
foreach ($studyMode in @('seed','stress')) {
  node "$studyRoot/performance.cjs" $studyMode 1000 29
}
node "$studyRoot/performance.cjs" mixed 10000 17
```

1k seed17 retrieval/updates/mixed не измерялись и не входят в эту последовательность. Исторический Node vector benchmark был перед seed29stress, но не должен пересекаться с любой нагрузкой; его placement после завершённых quality jobs и до/после отдельного performance batch не меняет алгоритмический input. Scope100k одновременно меняет U и I, а stressseed29 меняет shape, не является stochastic repeat.

Перед удалением **только принадлежащих текущему воспроизведению** контейнеров сохранить новые inspect/data-dir/results. Image tags могут дрейфовать: для строгого environment repeat использовать manifests/digests из containers.json, а не объявлять tags неизменными. Скрипты не перезаписывают существующий experimental seed; пользовательские/рабочие БД не являются расходным материалом.

#### Дополнения повторной проверки

Все нагрузки запускать последовательно. Historical legacy и новая bounded policy имеют разные имена файлов; нельзя подменять 3-seed historical means seed17 bounded-результатами. Для повторения нового bridge сначала создать его отдельную Mongo, а baseline контейнер с тем же loopback портом предварительно корректно завершить.

```powershell
& $studyPython "$studyRoot/recheck/bounded_rrf.py"
& $studyPython "$studyRoot/recheck/folded_bounded.py"
docker run -d --name bisky-study-20261101-recheck-mongo --label bisky.study=20261101-recheck --cpus=2 --memory=3g -p 127.0.0.1:27191:27017 mongo:8.0.17 --bind_ip_all --wiredTigerCacheSizeGB 1
node "$studyRoot/recheck/functional.cjs"
node "$studyRoot/recheck/functional.cjs" --benchmark
node "$studyRoot/recheck/warm-serving.cjs"
```

Функциональный fixture создаётся только в своих prefixed DB; на новом повторении не использовать сохранённые прежние результаты как новые измерения. Новые .py импортируют pinned dependencies из recheck/quality-deps либо quality/deps. Все три исторические версии имеют исходные recorded SHA:935079… сохранена как original; cf16d503… и 18b64… восстановлены побайтно и явно помечены reconstructed. Совпадение проверено криптографически, historical manifests сохранены. Точное соответствие исполнявшихся версий описано в quality/benchmark-version-provenance.json: реконструированные копии помечены явно, historical runtime manifests не перезаписаны.

### 10.4. Проверки и очистка

Проверки выполнены после benchmarks, отдельными процессами:

- Существующий RecommendationsService unit suite: **37 passed**, 0 failed.
- Пять существующих MongoDB integration suites: **106 passed**, 0 failed; disposable Mongo 8.0.17/Redis 8.2.3 Testcontainers закрыты штатным teardown.
- Metric tiny oracle, независимый sparse-mask review и heap32cases; Node/Python 100-profile parity. Quality final-run-events: все 21 последовательных jobs завершились code0. Первый invalid VNDB run исключён, причина сохранена.
- SHA-256 **1281 исходных tracked files** совпали; HEAD прежний. Production/package/lockfile/test sources не менялись. Type-check/build/full suite/Storybook не запускались: итоговая правка — документация, узкие runtime oracle suites проверены.
- Локальные Markdown links, отсутствие незаполненных sections/NaN, численные таблицы и фактический Git status проверены завершающим QA.

Исследовательские Mongo/Meili containers и их anonymous volumes удалены после проверки label ownership и сохранения inspect/storage/results. На момент cleanup иных контейнеров не было. Временные Python dependencies и распакованные копии datasets удалены; оригинальные compressed snapshots, selected data/model exports и evidence оставлены в ignored research directory для воспроизведения.

**Оставшееся изменение окружения:** Docker Desktop запущен исследованием и оставлен работающим. Автоматическая проверка разрешений отклонила остановку всего Docker Desktop из-за возможного воздействия на других потребителей общего сервиса; обход не выполнялся. Исследовательских контейнеров/томов больше нет, глобальные images и чужие ресурсы не удалялись.

**Состояние Git:** единственный новый неигнорируемый файл — docs/research/recommendation-system-study.md. Коммитов нет. Исходные пользовательские файлы и прежняя .temp сохранены. Подготовленные experimental collections не оставлены в рабочих БД; новая recommender implementation в проект не внедрялась.

Команды проверки (из apps/api, без coverage):

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects unit --runInBand --runTestsByPath src/endpoints/recommendations/__tests__/recommendations.service.test.ts
node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects integration --runInBand --runTestsByPath src/endpoints/recommendations/__tests__/recommendations.service.integration.test.ts src/entities/item/functions/createRecommendationPipeline/__tests__/createRecommendationPipeline.integration.test.ts src/entities/item/functions/createRecommendationTastePipeline/__tests__/createRecommendationTastePipeline.integration.test.ts src/entities/item/functions/createRecommendationRelationPipeline/__tests__/createRecommendationRelationPipeline.integration.test.ts src/entities/item/functions/createRecommendationEligibilityPipeline/__tests__/createRecommendationEligibilityPipeline.integration.test.ts
```

Полные JSON/логи и cleanup/integrity manifests сохранены. Ограничения проверки очереди/HTTP freshness и миллионной полноценной БД перечислены в§11; они не заменяются успешно пройденными unit/integration tests.

При повторной проверке добавлены bounded/exact-folded quality всех трёх domains,15-case canonical guard,100-profile warm parity и 400HTTP наблюдений. Новый own-контейнер/volumes и recheck/quality-deps удалены; исходные 1281files повторно сверены. Детали в recheck/integrity-after.json/cleanup.json/source-version-checks.json. Оригинальный отчёт и старый архив сохранены в recheck/ перед исправлениями. Обновлённый полный архив включает compresseddatasets, factor arrays и per-userNPZ; это локальный ignored artifact, не добавленный в Git.

## 11. Фактическая полнота задания и ограничения

Наличие всех разделов не равно полному выполнению всех экспериментов. После повторной проверки статус следующий; новая production-система не внедрялась.

| Запрошенная часть                                             | Фактический статус                           | Основание и граница                                                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Актуальная система, модели, индексы, профили, фоновые задачи  | Выполнено                                    | Статический аудит текущего кода, production service и реальные explain                                                                      |
| Самостоятельная baseline-производительность                   | Выполнено в заявленных условиях              | Каталоги 1k/10k/100k; три full100k наблюдения не дают надёжный p99                                                                          |
| Несколько независимых реальных datasets                       | Выполнено                                    | Anime/Steam/VNDB, исходные файлы/hashes/licenses сохранены                                                                                  |
| Корректные baselines, validation, полный каталог, uncertainty | Выполнено для shortlist                      | 3 seeds anime/Steam,1VNDB; новый bounded RRF и exact-folded fusion — seed17                                                                 |
| Качество всей текущей production Bisky                        | Частично                                     | Реальная плоская genre-адаптация, но нет всех необходимых настоящих metadata/relations/reactions                                            |
| Настоящий causal temporal replay                              | Не выполнено                                 | Anime/Steam без timestamps; VNDB может иметь позднее исправленные оценки со старой датой                                                    |
| Cold-user/item, negatives, diversity                          | Выполнены ограниченные offline ablations     | Укороченные реальные истории и held-out Item; не настоящие новички Bisky; h2–4/CI порога не измерены                                        |
| Adult-specific и cross-media перенос                          | Не выполнено                                 | VNDB включает all-ages, adult subset не выделен; общих людей между datasets нет                                                             |
| Все synthetic distributions и быстрая смена вкуса             | Частично                                     | Размеры, профиль 0/5/40,32 tags/depth7, similar vectors; нет полной Zipf/drift/hot-write сетки и semantic-drift quality                     |
| Миллионы Item и пользователей                                 | Частично                                     | Реально 1M factor rows; полная нормализованная million DB/users — только storage bounds                                                     |
| Сквозной путь нынешнего find                                  | Выполнено на service boundary                | Настоящий сервис/repository/projection/pagination; production HTTP route отсутствует                                                        |
| Интегрированный выбранный ML serving                          | Частично, дополнено при перепроверке         | Реальный bounded CF+foldALS→2workers→Mongo→HTTP/cards на 12294 Items/100 histories; без production-auth и полного набора фильтров           |
| Изменения доступности и порядок                               | Проверены узкие scenarios                    | 15 сравнений guard с oracle + late-delete; отдельные warm delete/block/region/global-ban cases; не исчерпывающий concurrency proof          |
| Reaction→transaction→queue→profile→видимость                  | Частично                                     | Handler/direct writes и mixed workload; полный queue wait/Stats transaction/visible latency не измерен                                      |
| Полная стоимость подготовки и cache lifecycle                 | Частично                                     | Build/fit/read/single-doc/profile costs и расчёт break-even; нет full incremental cascade/cache invalidation/hit-ratio workload             |
| Foreground вместе с background                                | Частично                                     | Reads+profile updates измерены совместно; trainer/full rebuild одновременно с foreground не проверены                                       |
| Cold/warm, CPU/RAM/disk/конкуренция                           | Частично                                     | Warm/first, реальные counters/storage/c1/c4; контролируемого OS-cold/долгого soak/ошибок сети нет                                           |
| Выбор архитектуры и спецификация                              | Выполнено как обоснованный инженерный проект | Ownership/formulas/schemas/indexes/budgets/recovery/release gates; собственные weights/SLO требуют будущей проверки                         |
| Воспроизводимость и сохранность                               | Выполнено с уточнениями                      | Полные команды, frozen inputs, source-version provenance, raw observations; восстановленные исходники отмечены; только report изменён в Git |
| Чистота окружения                                             | Выполнено для owned ресурсов                 | Containers/volumes/dependencies убраны; evidence сохранено; Docker Desktop остался как описано в§10.4                                       |

Причины недостающих частей — ограничения доступных данных и сознательный бюджет локального исследования, а не скрытые успешные результаты. Полная Zipf/drift сетка, физическая million DB, OS-cold/soak, queue-visible latency и simultaneous trainer load остаются невыполненными. Их отсутствие не делает наблюдённые числа недействительными, но исключает формулировку «вся система полностью проверена». Спецификация достаточна для инженерного старта без нового широкого обзора литературы; перед выпуском обязательны перечисленные release checks на собственной системе.

### Оставшиеся ограничения

- Собственная пригодная история Bisky и пользовательское online evidence в исследовании отсутствуют; рабочие БД намеренно не проверялись. Ни один offline winner не объявляется объективно лучшим для его будущих пользователей.
- Public ratings/plays — другие пользовательские задачи и exposure policies. Слабый жанровый baseline не доказывает слабость всей подробной Bisky-разметки. Snapshot не позволяет восстановить metadata as-of в прошлом.
- Нет связанных MAL/Steam/VNDB людей. Разные ID не соединялись; cross-media перенос не измерен. VNDB включает all-ages, без metadata adult subset не выделен; выводы не распространяются на все adult-игры.
- VNDB vote_date не гарантирует дату последнего изменения оценки; retrospective recorded-date holdout не является чистым causal temporal replay. Deleted/private votes и отбор активных выживших пользователей ограничивают выводы.
- Синтетические скоростные данные не доказывают relevance. Масштабирование только факторных массивов до миллиона не является тестом Mongo-каталога/миллиона пользователей или полноценной системы при таком размере.
- Host общий, без дискового/OS cold-cache reset и без production traffic. Ограниченный объём tail samples, нет длительного soak, network failures и распределённого deployment. Сервисные и RAM-only времена не смешиваются.
- Не выполнено исчерпывающее сравнение всех ML-классов, cloud-instance pricing и реальных text embeddings; нет основания объявлять отклонённые классы принципиально хуже. Отсечение основано на доступных данных, сложности и бюджете.
- Пороговые бюджеты, freshness и release gates ниже — предложения исследования. Их достижение будущей реализацией требует проверки на том же протоколе. Авторский judgment отделён от измерений.
- Требуют реальных пользователей: удовлетворённость, разумность отрицательных переносов, эффекты diversity/new-item exploration, перенос между media, быстрые изменения вкуса. Полная product analytics/A/B/retention инфраструктура не проектировалась.

## 12. Первичные источники

Все источники просмотрены 1 ноября 2026 года. Числа из статей не выдаются за измерения Bisky.

| Источник                                                                                                                                                                                                      | Использование                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Sarwar et al., WWW2001](https://ra.ethz.ch/cdstore/www10/papers/519/sdm2.html)                                                                                                                               | Item-based CF                                                                                      |
| [Hu–Koren–Volinsky, ICDM2008](https://yifanhu.net/PUB/cf.pdf)                                                                                                                                                 | Implicit confidence/preference, ALS                                                                |
| [Rendle et al., BPR2009](https://proceedings.mlr.press/r7/rendle09a.html)                                                                                                                                     | Pairwise objective и unobserved semantics                                                          |
| [Ning–Karypis, SLIM2011](https://doi.org/10.1109/ICDM.2011.134)                                                                                                                                               | Sparse linear baseline; библиографическая проверка, полный publisher text в этой сессии недоступен |
| [Steck, EASE2019](https://arxiv.org/abs/1905.03375)                                                                                                                                                           | Closed-form linear baseline и dense complexity                                                     |
| [Kula, LightFM 2015](https://arxiv.org/abs/1507.08439)                                                                                                                                                        | Feature/ID embedding hybrid                                                                        |
| [He et al., LightGCN 2020](https://arxiv.org/abs/2002.02126)                                                                                                                                                  | Collaborative graph class                                                                          |
| [Covington et al., YouTube2016](https://research.google.com/pubs/pub45530.html)                                                                                                                               | Candidate/ranker responsibility separation                                                         |
| [Burges, LambdaMART2010](https://www.microsoft.com/en-us/research/publication/from-ranknet-to-lambdarank-to-lambdamart-an-overview/)                                                                          | LTR alternative                                                                                    |
| [SASRec2018](https://arxiv.org/abs/1808.09781)                                                                                                                                                                | Последовательные модели                                                                            |
| [E5](https://arxiv.org/abs/2212.03533)                                                                                                                                                                        | Text retrieval alternative, без переноса BEIR quality на Bisky                                     |
| [HNSW](https://arxiv.org/abs/1603.09320)                                                                                                                                                                      | ANN complexity/approximation alternative                                                           |
| [Carbonell–Goldstein, MMR1998](https://www.cs.cmu.edu/afs/cs/Web/People/jgc/publication/MMR_DiversityBased_Reranking_SIGIR_1998.pdf)                                                                          | Relevance/redundancy ablation                                                                      |
| [Krichene–Rendle, KDD2020](https://research.google/pubs/on-sampled-metrics-for-item-recommendation/)                                                                                                          | Full-catalog protocol                                                                              |
| [Dacrema et al., RecSys2019](https://arxiv.org/abs/1907.06902)                                                                                                                                                | Настроенные простые baseline                                                                       |
| [implicit repository](https://github.com/benfred/implicit), [v0.7.3](https://github.com/benfred/implicit/releases/tag/v0.7.3)                                                                                 | Реально запущенная CPU implementation; short revision8a95dbe, wheel/version и hashes в артефактах  |
| [LightFM 1.17](https://github.com/lyst/lightfm/releases/tag/1.17)                                                                                                                                             | Рассмотренная implementation,688fede; не запущена                                                  |
| [LightGCN-PyTorch](https://github.com/gusye1234/LightGCN-PyTorch)                                                                                                                                             | Official repo архивирован 17.10.2023; не запущен                                                   |
| [Faiss releases](https://github.com/facebookresearch/faiss/releases)                                                                                                                                          | Рассмотрена v1.15.1,75c755c; не внедрён                                                            |
| [Mongo 8 indexed sorting](https://www.mongodb.com/docs/v8.0/tutorial/sort-results-with-indexes/), [explain](https://www.mongodb.com/docs/v8.0/reference/explain-results/)                                     | Проверка plan, разделение explain и wall time                                                      |
| [Meili sort specification](https://specs.meilisearch.dev/specifications/text/0055-sort.html), [ranking rules](https://specs.meilisearch.dev/specifications/text/0123-ranking-rules-setting-api.html)          | Сопоставимый retrieval                                                                             |
| [Anime source](https://www.kaggle.com/datasets/CooperUnion/anime-recommendations-database), [Steam source](https://www.kaggle.com/datasets/tamber/steam-video-games), [VNDB dumps](https://dl.vndb.org/dump/) | Реально полученные datasets; точные hashes ниже/в артефактах                                       |

## 13. Ручные предпочтения по тегам: исследование 2 ноября 2026 года

### 13.1. Рекомендация и статус

**Рекомендую сохранить ручные настройки отдельным ограниченным слоем внутри единой системы:** мягко корректировать кандидатов каждого канала только ненулевыми `explicitWeight` и выделить до 10 мест на тип для положительного ручного интереса **внутри**, а не сверх нынешней персональной/fallback-доли. Для этих мест получать небольшой дополнительный пул по явно выбранным тегам. CF/ALS и их обучение оставить прежними. Не возвращать полный вычисляемый content-профиль в serving и не сохранять второй полный Mongo recommendation pipeline.

Это **предложение исследования, требующее обсуждения**. Оно меняет отказ от любого content-fallback: появляется узкий metadata-источник только по прямым настройкам пользователя, в том числе без истории. Он не восстанавливает старое ранжирование по всей библиотеке. Меняются состав персональной доли и порядок новинок при активных настройках; молча считать это совместимым с утверждённым планом нельзя.

Простой пример: человек ещё ничего не оценивал, но выбрал «киберпанк +1, хоррор −1». Обычный fallback по рейтингу и дате вообще не использует этот выбор. Предлагаемая система немного понижает размеченный хоррор во всех каналах и отводит часть рейтинговой доли киберпанку. Остальные произведения остаются доступны; хоррор не заблокирован. Произведение без разметки не объявляется свободным от хоррора.

Два механизма нужны по разным причинам: reranker управляет уже найденными кандидатами; небольшой ручной источник находит кандидатов вне CF/ALS top500. Простое добавление кандидатов с малым бонусом не гарантирует им видимых мест. В локальном опыте большой бонус решал это ценой почти полного вытеснения истории (§13.6). Резерв ограничивает прямое вмешательство понятным числом мест. **10 мест и коэффициент 0.25 ниже — инженерные стартовые значения, не найденный оптимум.**

Основание: текущий [план, §§1, 3–4](../plans/recommendationsImplementationPlan.md), релевантные разделы [продуктового контракта](../product/foundations/recommendations.md), production-файлы ниже и новые изолированные эксперименты. Исторические предложения `recommendationSystem.md`, `crossTypeRecommendations.md` и рекомендации §§7–9 этого отчёта не отменяют более поздний план. Общая модель всех `EItemType` сохраняется; качество межтипового переноса этим опытом не измерено.

### 13.2. Что действительно делает текущий код

- [TasteTagPreference](../../../src/entities/userTasteProfile/schemas/tasteTagPreference.schema.ts) хранит `explicitWeight ∈ [−1,1]`; 0 означает отсутствие ручной настройки, а не явную нейтральность.
- [createRecommendationTastePipeline](../../../src/entities/item/functions/createRecommendationTastePipeline/core/createRecommendationTastePipeline.ts) использует ненулевой ручной вес вместо `weight × count/(count+5)`. Ручному весу не нужен `count > 0`; дополнительное ослабление по уверенности истории к нему не применяется.
- Scorer читает назначенные `TagItem` с положительным `relevanceScore`, проверяет taste-enabled группы и применимость к типу, использует `Tag.weightModifier`, подавляет назначенных известных предков более конкретными назначенными известными тегами. Родители автоматически не назначаются. Незнакомый ребёнок родителя не подавляет.
- [TagItem](../../../src/entities/tagItem/schemas/tagItem.schema.ts) имеет уникальный индекс `{item:1, tag:1}` и обратный `{tag:1, item:1}`. `relevanceScore` — выраженность признака в `(0,1]`, не уверенность разметчика. [Tag](../../../src/entities/tag/schemas/tag.schema.ts) хранит родителей и конечный неотрицательный modifier; схема не ограничивает его сверху значением 2, это предел текущего расчётного правила.
- [TAG_GROUP_RULES](../../../src/entities/tag/static/TAG_GROUP_RULES.ts) задаёт `isUsedForTaste` и допустимые типы. Например, игровые механики нельзя переносить на будущие книги только потому, что профиль общий.
- [RecommendationsService](../../../src/endpoints/recommendations/services/recommendations.service.ts) читает весь профиль и передаёт его существующему scorer. [Основной pipeline](../../../src/entities/item/functions/createRecommendationPipeline/core/createRecommendationPipeline.ts) считает затем `1+tasteScore/2`, relation/planned boosts, сортирует и пагинирует. В новом CF/ALS-плане эквивалент применения `explicitWeight` пока не определён.

Важное изменение семантики: у ALS нет отдельного вычисленного «веса хоррора», который можно заменить. Корректировка после модели **не удаляет** связи хоррора из обученных факторов. Поэтому новый слой обеспечивает явное управляемое влияние, но не точное прежнее обещание «ручной вес заменяет вычисленный вес этого признака». Сохранить такое обещание буквально при непрозрачном CF/ALS-score нельзя без другой модели или гораздо более сильной политики ранжирования.

### 13.3. Сравнение реальных альтернатив

| Вариант                                                               | Что даёт относительно отсутствия ручных весов                                                        | Что не решает / цена                                                                                                                                                                | Решение                                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Оставить утверждённый CF/ALS + рейтинг/новинки без корректировки      | Самая простая реализация; прежние offline-метрики относятся к неизменённой модели                    | Ручные настройки не работают, особенно у новичков; сохранённые настройки нельзя показывать как действующие                                                                          | Допустимо только при явном продуктовом отказе от этой функции              |
| Только explicit-rerank ограниченных пулов                             | Малое добавление; быстрый отклик без fit; поддерживает оба знака                                     | Не найдёт Item вне пула. Нiche/cold интерес может остаться невидимым; новинки без vector доступны только через уже имеющийся источник                                               | Полезная часть схемы, недостаточная как полное сохранение ручного интереса |
| Добор по положительным тегам + тот же additive rerank                 | Расширяет recall, не требует обученной модели для нового Item                                        | Новый кандидат с нулевым CF/ALS-вкладом может всё равно не дойти до видимых мест; сильный бонус подавляет историю                                                                   | Лучше одного reranker, но сам по себе не решает управляемость              |
| **Добор + небольшой резерв внутри существующей доли + мягкий rerank** | Ограниченная возможность показать прямой интерес вне модели; отрицательные значения остаются мягкими | Дополнительный источник, правила распределения и чтение metadata; резерв и сила требуют пользовательской проверки                                                                   | **Рекомендуемый компромисс**                                               |
| Сохранить нынешний полный content pipeline рядом с CF/ALS             | Больше прежних возможностей signed taste и exact tag scoring                                         | Двойная персонализация по истории, прежние joins/graphLookup, два владельца порядка и freshness; против цели одной системы                                                          | Не рекомендую                                                              |
| Превращать ручной тег в фиктивные likes/dislikes множества Items      | Меняет fold-in и потенциально retrieval                                                              | Приписывает оценки невиденным произведениям; распространённый тег создаёт много наблюдений, знак тега превращается в оценку всех Items; нужна политика confidence и новые ablations | Не рекомендую для V1                                                       |
| Проекция тегов в ALS-space / metadata-aware модель                    | Может совместить metadata и retrieval, поддержать cold items                                         | Нужны обучение feature mapping, собственные данные, versioning и новый quality-протокол; signed ручная сила не получается автоматически                                             | Рассматривать при доказанном ограничении простого слоя                     |

В `implicit` отрицательные confidence действительно могут обозначать dislike **Item**, но это не API ручного dislike **тега**. Ни их поддержка, ни старый отрицательный rating ablation в §5 не обосновывают автоматическую раздачу dislikes всему каталогу. Общую положительную матрицу, порог пяти известных positive и один комплект CF/ALS предлагается не менять.

### 13.4. Конкретная предлагаемая схема

#### Подготовка ручного сигнала

Читать актуальные ненулевые `explicitWeight` независимо от готовности вычисленного `weight/count`. Использовать только этот ручной набор: не подставлять вычисленный вес при нуле и не добавлять signed профиль поверх истории CF/ALS. Рассчитанный профиль может сохраняться для уже согласованных задач; его наличие не делает его ещё одним serving-сигналом.

Для кандидата `i` множество `A(u,i)` состоит из назначенных ему существующих ручных тегов, применимых к его типу по `TAG_GROUP_RULES`, с `relevanceScore > 0`. Из него убрать предков других тегов этого же множества через транзитивный `Tag.parents`. Подавлять предка и при противоположных знаках; не выводить назначения родителей из ребёнка. **В этом новом слое «известный» означает ненулевой ручной тег**: вычисленный ребёнок из истории не должен отменять ручного родителя. Это намеренное отличие от старого полного scorer, необходимое для отказа от второго учёта истории.

```text
e(u,i) = Σ[t∈A] explicitWeight(u,t) × relevance(i,t) × modifier(t)
         / Σ[t∈A] modifier(t)

если A пусто или знаменатель равен 0: e(u,i) = 0
modifier(t) = текущий Tag.weightModifier (при отсутствующем поле — 1)
```

`e ∈ [−1,1]`: modifier неотрицателен, relevance не превосходит 1. Никакой min-max-нормализации по текущему пулу: она делала бы силу настройки зависимой от соседних кандидатов и могла бы усилить малый ручной вес до максимального. Relevance только в числителе; один слабо выраженный тег даёт слабое влияние. Незнакомая разметка не входит в знаменатель. Отдельный общий IDF не добавляется поверх modifier.

Несколько независимых интересов не превращать в AND: достаточно одного положительного назначенного тега; отсутствие второго не штрафуется. Совпавшие положительные и отрицательные сигналы могут компенсироваться. `e=0` — отсутствие суммарной поправки, а не доказанная нейтральность произведения. Добавление другого явно настроенного тега меняет среднее и может ослабить штраф: это свойство предлагаемой простой формулы, не гарантия абсолютного отрицательного приоритета.

#### Кандидаты и порядок внутри каналов

1. Проверить сессию, нормализовать условия, зафиксировать модель и актуальную пользовательскую revision. Ключ списка включает условия; результат публиковать только при сохранении revision. Обновление explicit-настроек инвалидирует списки после Mongo commit по уже принятому правилу; фоновой пересборки вычисленного вкуса ждать не нужно.
2. Для каждого выбранного типа получить обычные CF500 и ALS500 по существующим правилам. После допустимости и дедупликации считать **прежний** bounded RRF с 0.5/0.5, рангами от 1 и нулём отсутствующего источника. Не выдавать ручному кандидату выдуманный CF/ALS-ранг.
3. Для популярного и новинок предложить ограничение пула до 500 допустимых Items на канал и тип, отсортированных по базовым правилам плана. Эти новые бюджеты также требуют обсуждения: план фиксирует 500 только для CF/ALS. Eligibility и теги запроса должны участвовать в отборе; сначала обрезать глобальный список и затем проверять редкий фильтр — другой, более слабый retrieval.
4. Пакетно прочитать необходимые TagItem/Tag для ограниченного объединения. На каждом канале применить один ручной scorer:

```text
B_CFALS(i) = 61 × [0.5/(60+rankCF) + 0.5/(60+rankALS)]
             каждый член только при наличии в его top500
B_pop(i)   = 61/(60+rankByApprovedRatingOrder(i))
B_new(i)   = 61/(60+rankByApprovedReleaseOrder(i))

S_channel(u,i) = B_channel(i) + λ × e(u,i)
λ = 0.25 как осторожный старт для проверки
```

Это ограниченная поправка `±λ` к rank-score с верхней границей 1, **не вероятность качества и не калибровка CF/ALS с рейтингом**. Каналы между собой scores не сравнивают: их смешивают по квотам. Порядок при равном `S` разрешать прежним базовым порядком данного канала. При пустом ручном профиле полностью пропускать этот слой, сохраняя прежние IDs, порядок, квоты и стоимость чтения metadata. Умножение на `1+λe` не выбрано: при `B=0` оно не поможет новому ручному кандидату.

5. Если есть положительные применимые настройки, получить **дополнительный ручной пул до 500 уникальных допустимых Items на тип**. Условие источника — хотя бы один такой назначенный тег и итоговый `e>0`; это условие входа только в ручной источник, не фильтр всего ответа. Для каждого положительного тега строить bounded список совпадений, внутри него `e DESC`, затем существующий `ratingScore DESC`, `ratingsCount DESC`, `_id ASC`. Объединять списки round-robin в порядке `explicitWeight DESC, tagId ASC`, пропуская повторы, до общего лимита 500; так частый интерес не забирает весь пул первым. Порядок ручного источника — этот round-robin, без второй RRF-награды за тот же тег.
6. Из ручного источника отвести до 10 мест в рамках персональных 70 либо fallback 60. Удалить выбранные IDs из остальных каналов и добрать их обычными кандидатами; распределить ручные места равномерно внутри соответствующей доли, затем выполнить согласованное смешивание каналов и типов. Недоступные ручные места возвращаются обычной доле. Это шанс показа прямого интереса, а не обещание, что каждое произведение или первая карточка ему соответствует. Ручной источник не должен сам расширяться сверх 10 мест из-за дефицита CF; общий добор выполняется обычными источниками без ослабления фильтров.

Для warm-запроса ручной источник может включать Item без model vector и без оценок, если явный рейтинговый фильтр этого не запрещает. Для fallback сохранить условие его рейтинговой доли: ручные кандидаты там также требуют `ratingsCount > 0` и известный ratingAverage. Непрорейтингованный новый Item всё ещё может войти через 40% новинок; старый непрорейтингованный Item без модели в cold-fallback останется вне выдачи. Снять это ограничение означало бы ещё одно изменение состава fallback, здесь оно не предлагается.

7. Сформировать до 100 на тип, перемежать типы и сохранить итоговые IDs/порядок в Redis на 10 минут. Проверять revision перед публикацией, актуальную eligibility и карточки — при чтении порций. Metadata-поправку не вычислять заново на каждой странице сохранённого списка: это сломает курсорный порядок. После изменения настройки начать новый список по принятой invalidation-семантике.

#### Квоты и отрицательные значения

| Режим                | Без положительного ручного источника    | При его наличии и достаточных кандидатах                   |
| -------------------- | --------------------------------------- | ---------------------------------------------------------- |
| Пригодные CF/ALS     | 70 CF/ALS + 20 новинок + 10 популярного | **60 CF/ALS + до 10 ручных + 20 новинок + 10 популярного** |
| Без пригодных CF/ALS | 60 рейтинговых + 40 новинок             | **50 рейтинговых + до 10 ручных рейтинговых + 40 новинок** |

Числа относятся к целевому списку 100 данного типа. Для меньшего результата — детерминированное пропорциональное распределение с верхней границей ручных мест; округление и порядок смешивания должны быть закреплены при реализации. Не использовать отдельную квоту на каждый тег, тип модели или глобальный общий резерв, который могли бы полностью забрать игры.

При **только отрицательных** весах нового источника нет, квоты исходные; меняется только порядок внутри каналов. Отрицательный вес никогда не удаляет Item, не превращает его и похожие Items в ALS dislikes, не влияет на binary positive для обучения. Если других кандидатов мало, произведение с отрицательным `e` всё равно можно вернуть. Для строгого запрета предназначены `IValueFilter.noneOf` по назначениям и блокировка конкретного Item. Даже `noneOf` не доказывает отсутствие темы при неполной разметке.

**Новинки предлагается тоже мягко корректировать**, сохраняя окно releaseDate за 90 дней, запрет будущего и отсутствие требования оценок. Базовый порядок — дата/рейтинг/ID; итоговый при активных настройках — `S_new`. Иначе 20%/40% выдачи систематически игнорировали бы ручную неприязнь. Это осознанный отход от утверждённой строгой хронологической сортировки, а не её реализация. Если продукту важнее именно хронология, следует оставить прежний порядок и прямо ограничить обещание настроек остальными каналами; это возможное, но здесь не рекомендуемое продуктовое решение.

### 13.5. Граничные случаи

| Ситуация                               | Предлагаемое поведение / граница                                                                                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Пустая история, есть ручные плюсы      | CF/ALS не включается; ручные рейтинговые места внутри 60% + rerank fallback/new. Это metadata-персонализация, не CF cold-user quality                                                                                                               |
| Тег отсутствует в обоих model top500   | Один reranker бессилен. Ручной источник ищет за этими границами; квота даёт шанс показа. Если лимит/фильтры не позволили retrieval, гарантии нет                                                                                                    |
| Новый Item без model vector            | Не синтезировать ALS vector. При попадании в new/manual источник можно использовать назначенные теги; отсутствие vector не является dislike                                                                                                         |
| Нет TagItem или нужной группы          | `e=0`; модель/рейтинг/дата продолжают работать. Не обещать отсутствие нежелательной темы и не поощрять специально пустую разметку                                                                                                                   |
| История любит хоррор, вручную −1       | История и факторы сохраняются, но размеченные кандидаты получают штраф во всех каналах. Сильная CF-позиция всё ещё может победить; это более слабый контракт, чем буквальное замещение признака в старом scorer                                     |
| Родитель −1, ребёнок +1, оба назначены | Ребёнок заменяет родителя в ручной поправке. Если назначен только ребёнок без ручной настройки, ручной родитель автоматически не применяется                                                                                                        |
| Уютные истории и мрачная фантастика    | Независимые совпадения, не обязательное сочетание. Round-robin retrieval поддерживает разные интересы; равное представительство всех тегов в финале не гарантируется                                                                                |
| Общий тег в игре и книге               | Один ручной вес, но применимость проверяется отдельно для типа. При отсутствии книжных factors работают общие manual/fallback/new правила; качество переноса из игры не доказано                                                                    |
| Много настроек, до 4096                | Scoring учитывает все применимые ручные теги. Retrieval ограничен 500 и ручными местами: нельзя гарантировать показ каждого интереса. Тысячи отдельных Mongo-запросов на первый запрос недопустимы; нужна пакетная реализация и отдельное измерение |
| Пользователь отменил настройку         | Ноль исключает тег из ручного слоя; история CF/ALS снова остаётся без этой поправки. Это не запрос «игнорировать тему» и не исключение из обучения                                                                                                  |

### 13.6. Новые воспроизводимые локальные эксперименты

**Реально выполнено 2 ноября, без сервисов, установки зависимостей и нового fit.** Файлы: [`.temp/bisky-manual-tags-20261102/experiment.py`](../../../../../.temp/bisky-manual-tags-20261102/experiment.py), `results.json`, `raw.json`. Использованы сохранённые anime factors и CF-экспорт из исследования 1 ноября: 12 294 Items, 43 плоских жанра, 100 сохранённых serving-историй. Сначала проверены SHA256 бинарных файлов по обоим manifest и исходного `anime.zip`; все 100 reconstructed CF/ALS результатов при исходном весе из manifest совпали с сохранёнными top20. Для нового сравнения использован плановый RRF 0.5/0.5, а не подобранный заново вес.

Seed17 split восстановлен тем же порядком групп и тем же NumPy RNG из `anime-selected.pkl`; тестовые положительные оценки не использовались для выбора ручных настроек или коэффициентов. Пользовательские train+validation Items исключены из warm-пулов. Профили **искусственные**: `Sci-Fi +1 / Horror −1`; `Comedy +1 / Horror +1 / Romance −1`; `Comedy −1`; редкий положительный жанр; proxy-плюс наиболее частому жанру positive-истории. Редкий жанр выбран по metadata как наименее частый с 20–200 назначениями, получился `Yaoi`; это технический критерий редкости, не вывод об adult-предпочтениях пользователей.

Настоящих ручных настроек Bisky нет. Relevance и modifier в этом опыте равны 1; реальных hierarchy, групп Bisky, releaseDate, bans, нескольких типов и production Mongo-пути в dataset нет. Для cold-сравнения модель и история не используются в ранжировании; Bayesian rating рассчитан по **выборке train+validation внешних оценок** с тем же сглаживанием 20 и её средним C. Это proxy, не сайт Bisky. В cold aligned-профиле сама искусственная настройка выведена из прежней истории: это имитация ввода интереса, не настоящий новый пользователь. Фиксированные cold-профили дают один повторяющийся список, а не 100 независимых холодных экспериментов.

6000 строк сырых наблюдений включают все варианты, параметры и пользовательские результаты. Проверены `λ ∈ {0.25,0.5,1}`, pool-only rerank, добавление до 500 manual-кандидатов без резерва и резерв 10. Сила и квота не оптимизировались по test; приведённая рекомендация — инженерная интерпретация последствий, без заявления статистического превосходства.

**Warm: пересортировка прежнего CF/ALS-пула, без ручного резерва, λ=0.25.** Средний пул 731.58; метрики относятся к первым 20 внутри персонального канала, не к окончательной смешанной выдаче 100.

| Искусственная настройка             | Доля положительного жанра: до → после | Доля отрицательного: до → после | NDCG@20 по прежним held-out likes: до → после |
| ----------------------------------- | ------------------------------------- | ------------------------------- | --------------------------------------------- |
| Sci-Fi + / Horror −                 | 22.25% → 50.80%                       | 6.50% → 1.00%                   | 0.3530 → 0.3100                               |
| Comedy + / Horror + / Romance −     | 49.35% → 76.80%                       | 32.30% → 10.15%                 | 0.3530 → 0.2784                               |
| Только Comedy −                     | —                                     | 43.00% → 12.00%                 | 0.3530 → 0.3107                               |
| Плюс частому жанру positive-истории | 52.45% → 82.75%                       | —                               | 0.3530 → 0.3429                               |

Механизм направляет выдачу в заданную сторону, но прежние likes могут воспроизводиться хуже. Даже history-aligned proxy не доказывает полезность усиления одного интереса. Снижение старой NDCG при намеренном противоречии истории не доказывает бесполезности управления; повышение доли нужного тега тоже не доказывает удовлетворённости. Из этих результатов нельзя вывести оптимальный λ.

**Редкий плюс особенно хорошо разделяет retrieval и ranking.** Ниже средние по тем же 100 warm-историям; «новых» означает вне прежнего объединения CF500/ALS500.

| Вариант                                     | Средний pool | Новых в top20 / top70 | Доля редкого тега в top20 | NDCG@20 прежних likes |
| ------------------------------------------- | ------------ | --------------------- | ------------------------- | --------------------- |
| Без ручных весов                            | 731.58       | 0 / 0                 | 0.10%                     | 0.3530                |
| Только rerank, λ=0.5                        | 731.58       | 0 / 0                 | 1.85%                     | 0.3532                |
| Добавить manual, λ=0.25                     | 767.60       | 0 / 0                 | 0.40%                     | 0.3536                |
| Добавить manual, λ=0.5                      | 767.60       | 0 / 18.65             | 1.85%                     | 0.3532                |
| Добавить manual, λ=1                        | 767.60       | 17.55 / 36.02         | 98.95%                    | 0.0189                |
| **Резерв до 10 из персональных 70, λ=0.25** | 767.60       | **2.00 / 9.46**       | **10.20%**                | 0.3320                |

При λ=0.5 добор уже помогает top70, но совсем не помогает первым 20 за счёт **новых** кандидатов. При λ=1 редкий тег почти захватывает top20. Резерв позволяет получить более ограниченное вмешательство без обещания «лучшей точности»: NDCG тоже снизилась. Порядок резерва здесь — один ручной Item на каждые семь позиций **внутри 70**. Финальные 20/10 и перемежение типов не моделировались; число ручных в первой реальной странице из этой таблицы не следует.

**Cold rare-профиль:** исходный рейтинговый pool500 не содержал этот жанр; один reranker дал 0% в top20. Добор расширил пул до 537; additive λ=0.5 дал 0% в top20, но 11 новых в top70. Резерв 10 внутри fallback60 дал три новых в первых 20 этого канала, то есть 15%, и десять во всём списке60. Held-out NDCG изменилась с 0.0424 до 0.0374. Здесь top70 для additive — диагностический срез пула, а не обещание 70 рейтинговых мест в cold-выдаче.

Дополнительно выполнены **15 искусственных проверок семантики**: слабая relevance не сокращается знаменателем, explicit=0 не включает историю, применимость/пустые группы, отсутствие metadata, нулевой modifier, обе стороны родительского подавления, несколько независимых интересов, сохранение окна новинок/отсечение будущего, возможность смены порядка дат, negative не удаляется, новый Item не требует vector, нулевые настройки сохраняют порядок. Вместе со 100 parity-проверками — **115 assertions**. Это проверка изолированной формулы, не существующих проектных тестов и не будущей production-реализации.

В 3500 наблюдениях ranking-only p50=0.132 ms, p95=0.187 ms: заранее вычисленные `e`, массивы в RAM, сортировка ограниченного пула через NumPy. Это **не** HTTP, Node, Mongo retrieval, загрузка metadata, обход ancestors, полный cold request или нагрузочный SLO. Общий локальный запуск занял около шести секунд по wall time команды; это не benchmark serving-задержки. Новые числа не заменяют и не дополняются старым `119.7s` другого поискового пути.

### 13.7. Стоимость и минимальные данные

Без ручных весов новый план проще: не нужны ни чтение TagItem на ранжировании, ни ручной retrieval. Только reranker добавляет чтение релевантных назначений и общий словарь тегов; добор и резерв дополнительно требуют источника кандидатов и явной политики его мест. Сохранять весь нынешний content scorer проще по объёму повторного использования кода, но значительно шире по serving-семантике, joins и согласованности; это противоречит желанию удалить старый pipeline после замены.

Для предложенной схемы достаточно существующих `explicitWeight`, `TagItem`, `Tag.parents`, `Tag.weightModifier`, `TAG_GROUP_RULES`, `Item`, `ItemStats`, `SiteStats` и общего Redis-списка. Для cold manual используются те же рейтинг/условия, что у обычного fallback. Новая коллекция пользовательских теговых векторов, vector DB, отдельный ML service и ежедневное обучение тегов не нужны. Общая RAM-структура Tag/ancestors может переиспользоваться workers; пользовательское подавление предков всё равно считается после отбора ручных тегов конкретного кандидата.

С предлагаемыми лимитами объединение до metadata-scoring ограничено **2500 уникальными IDs на тип** в warm-режиме: 500 CF + 500 ALS + 500 manual + 500 popular + 500 new. В cold — до1500. Реальное объединение обычно меньше; число типов умножает бюджет. Формирование при cache miss дороже нулевого ручного пути; чтение следующей страницы остаётся по сохранённым IDs и eligibility. Эти границы ограничивают downstream, **не число просмотренных Mongo документов**.

Существующий `{item,tag}` подходит для batch scoring, `{tag,item}` — для нахождения назначений. Но второй индекс **не обеспечивает** сортировку по ratingScore, releaseDate или итоговому `e` из другой коллекции. На частом теге join + sort может просмотреть большую долю каталога; один `limit500` после sort не доказывает дешёвого retrieval. Изолированный файл-эксперимент этот риск не измерял.

При реализации сначала проверить на изолированном Mongo `explain`, examined docs/keys, время и RAM для редкого/частого тега, 1/32/4096 настроек, разных типов и строгих фильтров. Делать пакетный retrieval, не 4096 последовательных сетевых запросов и не `$graphLookup` всего каталога. Общие ancestors можно подготовить по справочнику; новые составные индексы или shared read model с сортируемыми полями добавлять только после конкретного query plan и измерений. Сейчас нет данных, оправдывающих отдельную инфраструктуру.

Если этот простой Mongo retrieval не укладывается в бюджет, сначала уменьшить ручной пул/ограничить fan-out с явно описанной неполнотой. Нельзя незаметно выбирать только 32 из 4096 настроек и заявлять полную поддержку. При временном отказе ручного retrieval допускается исходный разрешённый CF/rating/new список, но это degraded-режим с причиной в логах; он не должен публиковаться как полноценно применивший ручные плюсы. Отказ eligibility-проверок по-прежнему не разрешает unchecked выдачу.

Сложность оценивается как **умеренная**: один небольшой scorer, один Mongo-источник, subquota/dedup и включение metadata в существующий lifecycle списка. Наиболее неопределённая стоимость — retrieval популярных тегов; не арифметика взвешенного среднего. Это оценка объёма, не измеренная длительность разработки. Full pipeline рядом, feature-aware fit или projected tag-vectors заметно расширяют систему и сейчас не оправданы.

### 13.8. Что обсудить перед дополнением утверждённого плана

1. Подтвердить сохранение ручного управления с новым честным контрактом: влияние на выдачу, но не буквальное удаление признака из CF/ALS и не ban. Смена настройки не переобучает общую модель.
2. Явно разрешить узкий ручной metadata-источник, несмотря на прежний отказ от content-fallback. При достаточных плюсах: 60 CF/ALS +10 manual +20 new +10 popular; cold:50 popular +10 manual-rated +40 new. Без такого источника — прежние доли. Это предложение, а не уже согласованная замена «70% CF/ALS».
3. Согласовать применение ручной поправки к popular **и новинкам** и соответственно изменение строгого порядка releaseDate при активных настройках. Окно новизны и критерии рейтингового источника сохранить.
4. Закрепить формулу explicit-only, правила групп/предков, начальные λ=0.25, reserve10 и pool500; определить детерминированное округление для неполных списков. Не объявлять числа оптимальными.
5. В уже запланированных моках проверить весь путь, включая модели, cold/new/no-metadata, противоречие истории, много тегов, несколько типов, фильтры и revision-race; конкретное создание/изменение проектных тестов в это исследование не входило.
6. До выпуска измерить Mongo retrieval и сквозную стоимость cache miss, затем проверить полезность настроек с людьми. Важны не только старые held-out likes, но понятность эффекта настройки, удовлетворённость результатом и доля неожиданного нежелательного содержания. Новая analytics/A/B-инфраструктура этим предложением не требуется.

План, TODO, production-код, проектные тесты и Git index в ходе исследования не изменялись. Результат этого раздела — конкретная схема для обсуждения и доказательства её технических границ; полезность для настоящих пользователей и цена Mongo retrieval остаются открытыми.

### 13.9. Воспроизведение и первичные источники дополнения

Команда из корня checkout, без установки пакетов:

```powershell
& 'C:\Users\vanya\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .temp/bisky-manual-tags-20261102/experiment.py
```

Среда: Windows 11 `10.0.26300`, Python `3.12.14`, NumPy `2.3.5`, pandas `3.0.1`; BLAS/OMP threads=1 задаются до импорта. SciPy и implicit в текущем runtime отсутствуют и не устанавливались: использованы готовые factors/CF-массивы. Скрипт читает CSV прямо из ZIP, не распаковывает/меняет исходный архив исследования. Для повтора нужны сохранённые файлы `.temp/bisky-study-20261101`; восстановление архива описано в §10.

Полный список входов и их SHA256 — `results.json:inputs`; исходный anime ZIP SHA256 `49595ab309d1d773ae66464379dc23d813466199816ae6b24e38bc73b8f2cd12`, item-factors `f0f53f5382a1efd0a293add9b07851e431ba48e60bcc2441f46bbbba172fed52`. Новые raw results хранятся отдельно от прежнего reproducibility.zip. `status-before.txt`, `head-before.txt`, `tracked-before.json` и `verification.json` фиксируют границы изменений; скрипт сохраняет входные hashes, версии, каждый искусственный профиль, метрики и результаты assertions. Время сортировки может меняться при повторе; ранжирование/метрики детерминированы при тех же входах.

Источники повторно просмотрены **2 ноября 2026 года**; это основания различать классы решений, не измерения Bisky:

- [Covington et al., YouTube2016](https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/): разделение получения кандидатов и их ранжирования. Вывод «reranker не возвращает потерянного кандидата» относится и к этому предложению; статья не обосновывает наши квоты.
- [Hu–Koren–Volinsky, 2008](https://yifanhu.net/PUB/cf.pdf): раздельные preference/confidence в implicit-feedback модели. Ручной tag-weight нельзя без дополнительного решения считать confidence оценки каждого размеченного Item.
- [Kula, LightFM2015](https://arxiv.org/abs/1507.08439): представление user/item через embeddings metadata — реальная альтернатива для cold-start, но его результаты не подтверждают выигрыш на Bisky и не дают готовой семантики signed ручных весов.
- [Официальный CPU ALS source v0.7.3](https://github.com/benfred/implicit/blob/v0.7.3/implicit/cpu/als.py): `fit`/`recalculate_user` работают с user-item confidence, а не произвольными tag-настройками; negative values могут представлять dislike Item. Context7 использован с `/benfred/implicit` по этому вопросу; выдача ссылалась на `main`, поэтому версия дополнительно проверена по исходнику тега `v0.7.3`, совпадающего с прежним исследованием. Публичная [API-документация](https://benfred.github.io/implicit/api/models/cpu/als.html) обозначена как 0.7.2 и не использовалась как доказательство новой version-specific семантики.

Граница вывода: локально доказаны управляемость указанных массивов, важность candidate coverage, компромисс силы бонуса и функциональные правила прототипа. **Не доказаны** качество ручных настроек реальных людей, оптимум λ/квоты, cross-media качество, полнота Bisky-разметки, Mongo/runtime latency и корректность ещё не реализованного production-пути.
