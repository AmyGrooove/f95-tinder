# Ключи справочников каталога

[Структура данных](dataStructure.md) · [Наполнение каталога](catalogWorkflow.md)

Документ фиксирует согласованный начальный набор ключей для семи типов Item. Это контракт наполнения справочников, а не подтверждение наличия записей в БД или готовности импортёров.

Поля key у Tag, Feature, ItemRelationRole и Source остаются строковыми идентификаторами с проверкой camelCase и уникальности. Enum в коде именуют ключи, которые явно обрабатывает программная логика, и не ограничивают весь словарь. Добавление новых понятий проходит согласование по правилам наполнения каталога.

## Feature.key

Начальный перечень содержит только следующие 15 ключей:

| Ключ                    | Значение                                                       | valueType | group       | unit     |
| ----------------------- | -------------------------------------------------------------- | --------- | ----------- | -------- |
| `releaseYear`           | Год первого выпуска                                            | `number`  | `release`   | `null`   |
| `releaseDateWorld`      | Дата первого мирового выпуска                                  | `date`    | `release`   | `null`   |
| `releaseStatus`         | Состояние выпуска                                              | `string`  | `release`   | `null`   |
| `minimalAge`            | Возрастное ограничение из источника                            | `number`  | `null`      | `null`   |
| `duration`              | Продолжительность фильма в минутах                             | `number`  | `technical` | `minute` |
| `episodeCount`          | Общее число серий сезона, если известно                        | `number`  | `technical` | `null`   |
| `releasedEpisodeCount`  | Число уже вышедших серий сезона                                | `number`  | `release`   | `null`   |
| `episodeDuration`       | Ориентировочная длительность обычной серии в минутах           | `number`  | `technical` | `minute` |
| `seasonNumber`          | Номер сезона для отображения                                   | `number`  | `technical` | `null`   |
| `nextEpisodeAt`         | Известная дата и время ближайшего выпуска серии                | `date`    | `release`   | `null`   |
| `hasDefinedEnd`         | Есть ли у базовой игры предусмотренное конечное прохождение    | `boolean` | `null`      | `null`   |
| `mainStoryDuration`     | Ориентировочное время основной истории базовой игры без DLC    | `number`  | `technical` | `minute` |
| `completionistDuration` | Ориентировочное время полного прохождения базовой игры без DLC | `number`  | `technical` | `minute` |
| `esrbRating`            | Исходное обозначение классификации ESRB                        | `string`  | `null`      | `null`   |
| `pegiRating`            | Исходное обозначение классификации PEGI                        | `string`  | `null`      | `null`   |

Общие ключи для всех типов: releaseYear, releaseDateWorld, releaseStatus и minimalAge. Наличие каждого значения необязательно.

| Item.type        | Дополнительные ключи                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `movie`          | `duration`                                                                                 |
| `series`         | `episodeCount`, `releasedEpisodeCount`, `episodeDuration`, `seasonNumber`, `nextEpisodeAt` |
| `animatedMovie`  | `duration`                                                                                 |
| `animatedSeries` | `episodeCount`, `releasedEpisodeCount`, `episodeDuration`, `seasonNumber`, `nextEpisodeAt` |
| `animeMovie`     | `duration`                                                                                 |
| `animeSeries`    | `episodeCount`, `releasedEpisodeCount`, `episodeDuration`, `seasonNumber`, `nextEpisodeAt` |
| `game`           | `hasDefinedEnd`, `mainStoryDuration`, `completionistDuration`, `esrbRating`, `pegiRating`  |

### Семантика значений

- Для сезона даты выпуска относятся к конкретному сезону; releaseDateWorld означает выпуск первой серии. Для игры дата относится к первому выпуску базовой игры, а не к каждому последующему порту. Равнозначная releaseDate параллельно не создаётся.
- Год может быть известен без точной даты. Неизвестные и неприменимые значения не записываются в ItemFeature и не заменяются нулём, false или выдуманной датой.
- Для сезона releaseStatus принимает announced, ongoing, released или cancelled. released означает завершение выпуска сезона. Для игры released означает релиз базовой игры; продолжающиеся обновления сами по себе не означают ongoing.
- episodeCount — положительное целое число; releasedEpisodeCount — неотрицательное целое число, не превышающее известный episodeCount. Известный ноль вышедших серий отличается от неизвестного значения. Счётчики не отражают личный прогресс.
- episodeDuration — ориентир для обычной серии, а не гарантия одинаковой длительности всех эпизодов. seasonNumber служит отображению и не заменяет Relation или идентичность произведения.
- hasDefinedEnd описывает свойство игры для всех пользователей. При false оценки времени основной истории и полного прохождения неприменимы. Обе оценки при наличии относятся к базовой игре без DLC и не измеряют время попытки пользователя.
- esrbRating и pegiRating сохраняются раздельно. Из них автоматически не выводится minimalAge.
- Цена и общий maxPlayers в начальный набор не входят: цена зависит от платформы и региона, число игроков — от режима.

## Tag.key

Один смысл имеет один канонический Tag независимо от Item.type. Совпадающие названия с разным смыслом относятся к разным тегам. Применимость ниже показывает, где признаки особенно полезны, а не устанавливает запрет их использования у других типов.

### Общие содержательные признаки

| Tag.group               | Ключи                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `genre`                 | `drama`, `comedy`, `horror`, `scienceFiction`, `fantasy`                                       |
| `keyword` — темы        | `loneliness`, `friendship`, `revenge`, `familyRelationships`, `moralDilemmas`, `survivalTheme` |
| `style` — повествование | `darkHumor`, `nonlinearNarrative`, `slowNarrativePacing`, `surrealism`                         |
| `style` — атмосфера     | `darkAtmosphere`, `tenseAtmosphere`, `cozyAtmosphere`, `melancholicAtmosphere`                 |

### Дополнения по типам

| Item.type        | Ключи и группы                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `movie`          | `documentary`, `mockumentary` — format; `foundFootage` — style                                             |
| `series`         | `anthology` — format; `episodicNarrative`, `continuousNarrative` — style                                   |
| `animatedMovie`  | `twoDimensionalAnimation`, `threeDimensionalAnimation`, `stopMotion` — style                               |
| `animatedSeries` | Те же техники анимации — style; `anthology` — format; `episodicNarrative`, `continuousNarrative` — style   |
| `animeMovie`     | Те же техники анимации — style; `mecha`, `isekai`, `schoolLife` — keyword                                  |
| `animeSeries`    | Те же техники и темы; `episodicNarrative`, `continuousNarrative` — style                                   |
| `game`           | `rolePlayingGame`, `firstPersonShooter`, `strategyGame`, `platformer`, `puzzleGame`, `visualNovel` — genre |

Техники анимации в таблице обозначают один общий набор ключей; отдельных копий тегов для мультфильмов и аниме не создаётся.

### Игровые механики и режимы

| Tag.group | Ключи                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `style`   | `branchingNarrative`                                                                                                                                     |
| `keyword` | `meaningfulChoices`, `exploration`, `stealth`, `crafting`, `baseBuilding`, `resourceManagement`, `survivalGameplay`, `turnBasedCombat`, `realTimeCombat` |
| `format`  | `singlePlayer`, `cooperativeMultiplayer`, `competitiveMultiplayer`                                                                                       |

survivalTheme описывает тему выживания, survivalGameplay — игровую механику. Эти понятия не объединяются по совпадению названия. Аналогично сюжетный экшен не приравнивается автоматически к жанру игрового экшена. branchingNarrative может использоваться у другого типа, если описывает тот же смысл.

### Фактические признаки

| Tag.group          | Начальные ключи                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `country`          | `countryJapan`, `countryUnitedStates`, `countryRussia`                                            |
| `originalLanguage` | `languageJapanese`, `languageEnglish`, `languageRussian`                                          |
| `platform`         | `platformWindows`, `platformLinux`, `platformMacos`, `platformPlayStation5`, `platformXboxSeries` |

Списки стран, языков и платформ расширяются по данным каталога. originalLanguage описывает язык оригинала, а не доступные переводы или локаль интерфейса. Платформы игры хранятся несколькими ItemTag одного Item, без отдельных карточек игры на каждую платформу. Для платформ relevanceScore=1 фиксирует доступность.

Общие содержательные теги дают основу сопоставления разных типов контента. Их наличие не задаёт одинаковый вес или автоматически сопоставимую шкалу relevanceScore между типами.

## ItemRelationRole.key

Ключи задают роли двух сторон Relation, а не отдельное поле Relation.type. Положение first/second само по себе не задаёт хронологию.

| group   | Роль одной стороны  | Роль другой стороны | Значение                                 |
| ------- | ------------------- | ------------------- | ---------------------------------------- |
| `all`   | `previousPart`      | `sequel`            | Предыдущая часть и прямое продолжение    |
| `all`   | `prequelBase`       | `prequel`           | Произведение и его приквел               |
| `all`   | `mainWork`          | `spinOff`           | Основное произведение и ответвление      |
| `all`   | `adaptationSource`  | `adaptation`        | Основа и адаптация                       |
| `video` | `recapSource`       | `recap`             | Исходное произведение и его пересказ     |
| `video` | `compilationSource` | `compilation`       | Исходное произведение и фильм-компиляция |

Роли all применимы ко всем семи типам Item, video — к шести видеотипам. Группа является классификацией словаря, а не проверкой типов сторон Relation. Специальные ключи только для game в начальном наборе не требуются; общие продолжения, ответвления и адаптации уже покрыты группой all.

Для следующего сезона используется прямая связь соседних сезонов. Франшиза задаётся Collection и не заменяет смысловую связь произведений. Связь сама по себе не устанавливает обязательный порядок потребления.

DLC и порты не получают отдельных ролей в этом наборе: они входят в Item игры. Роли для ремейков и ремастеров требуют отдельного решения о границах самостоятельного Item.

## Source.key

Согласованные кандидаты для внешних привязок:

| Item.type        | Ключи                                       |
| ---------------- | ------------------------------------------- |
| `movie`          | `kodik`, `kinopoisk`, `imdb`                |
| `series`         | `kodik`, `kinopoisk`, `imdb`, `mydramalist` |
| `animatedMovie`  | `kodik`, `kinopoisk`, `imdb`                |
| `animatedSeries` | `kodik`, `kinopoisk`, `imdb`                |
| `animeMovie`     | `kodik`, `shikimori`, `kinopoisk`, `imdb`   |
| `animeSeries`    | `kodik`, `shikimori`, `kinopoisk`, `imdb`   |
| `game`           | `igdb`, `steam`                             |

Source описывает сервис, SourceItem — его внешний объект и привязку к Item. Таблица не гарантирует покрытие каждого произведения источником. Совпадение названий само по себе не устанавливает идентичность.

Для игр igdb рассматривается как источник каталожных данных, steam — как привязка по App ID. Основания: [документация IGDB](https://api-docs.igdb.com/) и [модель приложений Steam](https://partner.steamgames.com/doc/store/application?l=english). Выбор основных поставщиков, условия использования и импорт требуют отдельной проверки; наличие Source не означает готовый клиент.

## Граница реализации

В коде EFeatureKey содержит hasDefinedEnd и releaseStatus, ESourceKey — kodik. Эти имена уже используются сервисами. Остальные согласованные ключи здесь задают контракт справочников и не означают расширение enum, создание записей БД или реализацию новых импортёров.

Схемы и текущее состояние реализации описаны в [сущностях API](../../api/entities.md); правила пользовательской завершённости — в [контракте библиотеки](../../api/librarySpec.md).
