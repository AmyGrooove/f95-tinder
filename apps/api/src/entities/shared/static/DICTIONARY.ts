const DICTIONARY = {
  home: {
    prepareFeedFailed: "Не удалось подготовить дневную ленту",
  },
  search: {
    invalidLatestReleaseDirection:
      "Новинки сортируются только по убыванию даты последнего релиза",
    bodyRequired: "Тело поиска должно быть JSON-объектом",
    invalidFilters:
      "Некорректные фильтры поиска: проверьте поля, типы значений и границы",
    unavailable: "Поиск временно недоступен или ещё подготавливается",
    invalidCursor: "Некорректный курсор поиска",
    enqueueFailed: "Не удалось поставить синхронизацию поиска в очередь",
  },
  knowledge: {
    unavailable: "Доступ к базе знаний не настроен",
    unauthorized: "Для доступа к базе знаний требуется авторизация",
    realm: "Bisky knowledge",
  },
  item: {
    notFound: "Произведение не найдено или удалено",
    adultGameTypeRequired: "18++ requires a game Item type",
    movieTypeRequired: "Movie details require a movie Item type",
    seriesTypeRequired: "Series details require a series Item type",
    gameTypeRequired: "Game details require a game Item type",
    releasedEpisodeCountExceedsTotal:
      "Released episode count must not exceed total episode count",
    invalidRatingRange: "Invalid item rating range",
  },
  recommendation: {
    bodyRequired: "Тело запроса рекомендаций должно быть JSON-объектом",
    invalidContentType: "Запрос рекомендаций принимает application/json",
    invalidRatingRange:
      "Укажите хотя бы одну границу рейтинга, минимальная не должна превышать максимальную",
    invalidCursor: "Некорректный курсор рекомендаций",
    cursorExpired: "Список рекомендаций устарел, начните выдачу заново",
    invalidLimit: "Размер порции рекомендаций должен быть 10, 20 или 50",
    unsupportedModelVersion:
      "Версия формата модели рекомендаций не поддерживается",
    invalidModelMetadata: "Некорректные метаданные модели рекомендаций",
    missingModelData: "В модели отсутствуют данные ItemCF или ALS",
    invalidItemCfArraySizes: "Некорректные размеры массивов ItemCF",
    invalidAlsData: "Некорректные параметры или размеры массивов ALS",
    invalidPopularityArraySize: "Некорректный размер массива популярности",
    invalidItemCfNeighbors: "Некорректные индексы соседей ItemCF",
    invalidModelNumbers: "Некорректные числовые значения модели рекомендаций",
    alsFoldInFailed: "Невозможно вычислить вектор пользователя ALS",
  },
  user: {
    library: {
      notFound: "Пользователь не найден",
      bodyRequired: "Тело запроса библиотеки должно быть JSON-объектом",
      queryNotAllowed: "Фильтры библиотеки передаются в теле запроса",
      unsupportedMediaType: "Для запроса библиотеки требуется application/json",
      sortLanguage: "Язык указывается только при сортировке по названию",
      invalidCursor: "Некорректный курсор библиотеки",
    },
  },
  userItem: {
    invalidDate: "Некорректная дата",
    notFound: "Личная запись произведения не найдена",
    itemNotFound: "Произведение не найдено или удалено",
    alreadyAdded: "Личная запись произведения уже существует",
    attemptNotFound: "Попытка не найдена",
    attemptNotAllowed: "Для текущего статуса нельзя добавлять попытки",
    attemptRequired: "Для текущего статуса требуется хотя бы одна попытка",
    skipHasPersonalData:
      "Нельзя пропустить произведение с оценкой, избранным, заметкой или попытками",
    invalidPercent: "Прогресс в процентах не может превышать 100",
    invalidEpisodeUnit:
      "Прогресс в сериях доступен только для сезонов сериалов",
    gameHasNoDefinedEnd:
      "Для игры без конечного прохождения недоступны завершение и прогресс в процентах",
    seasonReleaseNotFinished:
      "Нельзя отметить полный просмотр сезона, выпуск которого ещё не завершён",
    emptyUpdate: "Укажите хотя бы одно поле для изменения",
    invalidDates: "Дата завершения не может предшествовать дате начала",
  },
  fact: {
    notFound: "Факт не найден",
  },
  collection: {
    queryBodyRequired: "Тело запроса подборок должно быть JSON-объектом",
    invalidItemsCursor: "Недействительный курсор состава подборки",
    invalidRatingRange: "Минимальная оценка не может превышать максимальную",
    unavailableMode: "Режим grouped недоступен для этой подборки",
    unavailableSort:
      "Сортировка по значимости тега доступна только для теговых подборок",
    invalidFieldFilters:
      "Некорректные условия полей Item: проверьте поля, типы значений и границы",
    emptyUpdate: "Укажите хотя бы одно изменение подборки",
    versionConflict: "Версия подборки устарела, загрузите актуальные данные",
    versionLimit: "Достигнут предел версии подборки",
    invalidBlockChanges: "ID блоков повторяются или конфликтуют с удалением",
    blockNotFound: "Один или несколько блоков не принадлежат подборке",
    blockTypeChange: "Нельзя менять тип существующего блока",
    invalidBlockOrder:
      "Порядок должен содержать все итоговые ID блоков ровно один раз",
    invalidItemChanges:
      "ID произведений повторяются или конфликтуют с удалением",
    membershipNotFound:
      "Одно или несколько произведений отсутствуют в подборке",
    ownRatingForbidden: "Нельзя оценивать свою подборку",
    titleRequired: "Название подборки требует хотя бы один непустой перевод",
    duplicateBlocks: "ID блоков не должны повторяться",
    duplicateItems: "Произведение не может повторяться в подборке",
    invalidGroup: "Элемент должен ссылаться на группу этой подборки",
    itemNotFound: "Одно или несколько произведений не найдены или удалены",
    groupTitleRequired: "Название группы требует хотя бы один непустой перевод",
    notFound: "Подборка не найдена или удалена",
    groupContent: "Текст группы задаётся в названии и описании",
    textContentRequired: "Текстовый блок требует хотя бы один непустой перевод",
    textGroupFields: "Название и описание допустимы только для группы",
    invalidPosterRequest: "Требуются ID подборки и multipart/form-data",
    posterPublicUrlUnavailable: "Публичный адрес хранилища недоступен",
    tagCollectionGroupMissing: (id: string) => {
      return `Tag collection has no group: ${id}`
    },
  },
  tagItem: {
    partialWritePublishFailed:
      "Не удалось уведомить об изменениях после частичной записи тегов произведений",
  },
  tag: {
    invalidCursor: "Недействительный курсор тегов",
    searchUnavailable:
      "Словарь тегов временно недоступен или ещё подготавливается",
    searchEnqueueFailed: "Не удалось поставить синхронизацию тегов в очередь",
    selfParent: "Тег не может быть собственным родителем",
    duplicateParents: "Родительские теги не должны повторяться",
    invalidParents: "Родители должны быть массивом ObjectId тегов",
    unsupportedParentsWrite:
      "Используйте создание тега, сохранение документа или полную замену parents по конкретному _id без upsert",
    invalidDictionaryParent: (key: string) => {
      return `Invalid tag dictionary parent: ${key}`
    },
    invalidDictionaryGroup: (group: string) => {
      return `Invalid tag dictionary group: ${group}`
    },
    invalidGroupKey: "Tag key does not match its group rule",
  },
  account: {
    emailConfirmationInvalid:
      "Код подтверждения смены email недействителен или истёк, при необходимости запросите новый",
    emailUnavailable:
      "Изменение email доступно после первоначальной настройки аккаунта",
    emailResendTooSoon: "Повторный запрос смены email доступен через минуту",
    emailMailSubject: "Подтверждение смены email",
    emailMailText: "Код подтверждения смены email:",
    emailMailExpiration:
      "Код действует 4 часа. Если вы не запрашивали смену email, проигнорируйте письмо",
    emailMailUnavailable: "Не удалось отправить письмо, повторите запрос",
    emailCleanupFailed:
      "Не удалось удалить подтверждение после ошибки отправки письма смены email",
    passwordUnavailable:
      "Пароль ещё не установлен, завершите первоначальную настройку аккаунта",
    invalidPassword: "Текущий пароль недействителен",
    setupConfirmationInvalid:
      "Код подтверждения недействителен или истёк, при необходимости запросите новый",
    setupUnavailable: "Первоначальная настройка аккаунта недоступна",
    emailTaken: "Email уже занят",
    setupResendTooSoon: "Повторный запрос доступен через минуту",
    setupMailSubject: "Подтверждение настройки аккаунта",
    setupMailText: "Код подтверждения настройки аккаунта:",
    setupMailExpiration:
      "Код действует 4 часа. Если вы не запрашивали настройку, проигнорируйте письмо",
    setupMailUnavailable: "Не удалось отправить письмо, повторите запрос",
    setupCleanupFailed:
      "Не удалось удалить подтверждение после ошибки отправки письма настройки аккаунта",
    usernameTaken: "Логин уже занят",
  },
  auth: {
    passwordResetConfirmationInvalid:
      "Код сброса пароля недействителен или истёк, при необходимости запросите новый",
    passwordResetMailSubject: "Сброс пароля",
    passwordResetMailText: "Код подтверждения сброса пароля:",
    passwordResetMailExpiration:
      "Код действует 4 часа. Если вы не запрашивали сброс пароля, проигнорируйте письмо",
    passwordResetMailUnavailable:
      "Не удалось поставить письмо сброса пароля в очередь",
    passwordResetCleanupFailed:
      "Не удалось удалить подтверждение после ошибки отправки письма сброса пароля",
    invalidLoginCredentials: "Логин или пароль недействительны",
    invalidCredentials: "Секретный код недействителен",
    unauthorized: "Авторизация отсутствует или недействительна",
    sessionNotFound: "Сессия не найдена",
    usernameUnavailable:
      "Не удалось создать уникальный логин, повторите запрос",
  },

  tagGroupDescriptions: {
    genre:
      "Жанры; совпадающие названия с разным смыслом остаются отдельными понятиями",
    subgenre:
      "Поджанры со связями с родительскими жанрами; родители не назначаются автоматически и не учитываются как независимые подтверждения вкуса",
    keyword: "Темы, мотивы и содержательные признаки, кроме игровых механик",
    format: "Форматы произведений без дублирования Item.type",
    style: "Атмосфера, темп, стиль повествования и визуальные техники",
    audience:
      "Целевая аудитория; не заменяет возрастные ограничения и не выводится из них",
    country: "Страны производства, кроме регионов, городов и вымышленных стран",
    originalLanguage: "Только языки оригинала, без языков перевода",
    platform:
      "Доступные игровые платформы, кроме магазинов и устройств пользователя; порты используют общий Item",
    duration:
      "Длительность фильма по точному положительному значению в минутах",
    episodeDuration:
      "Ориентировочная длительность обычной серии по положительному значению в минутах",
    episodeCount:
      "Общее количество серий сезона по положительному целому значению",
    mainStoryDuration:
      "Оценка времени прохождения основной истории базовой игры в минутах, без DLC",
    fullCompletionDuration:
      "Оценка времени полного прохождения базовой игры в минутах, включая необязательный контент, но без DLC",
    gameLength:
      "Оценка длины игры как короткой или длинной по данным источника, без фиксированных порогов времени прохождения",
    releaseStatus:
      "Состояние выпуска произведения или сезона; обновления выпущенной игры не означают продолжающийся выпуск",
    hasDefinedEnd:
      "Наличие предусмотренного конечного прохождения базовой игры",
    ageRestriction:
      "Нормализованное возрастное ограничение; 18++ только для порнографических игр, не по одному внешнему рейтингу; преобразование ESRB и PEGI требует отдельно согласованной таблицы соответствий",
    releaseYear:
      "Год первого выпуска, включая будущие годы; диапазоны до 1990 года включают нижнюю и исключают верхнюю границу; известная точная дата имеет приоритет над тегом с отдельно указанным годом",
    gameMode:
      "Режимы игры; сотрудничество, соперничество, игра против окружения и разделение экрана описываются отдельно",
    gameMechanic: "Игровые действия и системы, отдельно от сюжетных тем",
    perspective: "Ракурсы камеры; VR не является ракурсом камеры",
  },

  itemFieldNames: {
    releaseDate: { ru: "Дата выпуска", en: "Release date" },
    ageRestriction: { ru: "Возрастное ограничение", en: "Age restriction" },
    duration: { ru: "Продолжительность", en: "Duration" },
    episodeCount: { ru: "Количество серий", en: "Episode count" },
    releasedEpisodeCount: {
      ru: "Вышедшие серии",
      en: "Released episode count",
    },
    episodeDuration: { ru: "Продолжительность серии", en: "Episode duration" },
    nextEpisodeAt: { ru: "Следующая серия", en: "Next episode" },
    mainStoryDuration: {
      ru: "Время основной истории",
      en: "Main story duration",
    },
    fullCompletionDuration: {
      ru: "Время полного прохождения",
      en: "Full completion duration",
    },
  },
} as const

export { DICTIONARY }
