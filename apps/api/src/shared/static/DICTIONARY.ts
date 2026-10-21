const DICTIONARY = {
  errors: {
    UNAUTHORIZED: "Требуется авторизация",
    FORBIDDEN: "Доступ запрещён",
    VALIDATION_ERROR: "Ошибка валидации",
    INTERNAL_ERROR: "Внутренняя ошибка сервера",
  },

  config: {
    MISSING_REQUIRED_ENVIRONMENT_VALUE:
      "Не задана обязательная переменная окружения",
    INVALID_ENVIRONMENT_URL: "Некорректный URL в переменной окружения",
    INVALID_URL_PROTOCOL:
      "URL в переменной окружения содержит недопустимый протокол",
    INVALID_NODE_ENV:
      "NODE_ENV должен иметь значение development или production",
    INVALID_PORT: "PORT должен быть целым числом от 1 до 65535",
    INVALID_APP_NAME:
      "APP_NAME должен быть именем бакета Garage в нижнем регистре длиной от 3 до 63 символов",
    INVALID_APP_VERSION:
      "APP_VERSION должен содержать корректную семантическую версию",
    EMPTY_APP_DESCRIPTION: "APP_DESCRIPTION не должен быть пустым",
    INVALID_CORS_ORIGINS:
      "CORS_ORIGINS должен содержать корректные источники HTTP(S) или '*'",
    EMPTY_CORS_ORIGINS: "CORS_ORIGINS должен содержать хотя бы один источник",
    PRODUCTION_CORS_ORIGINS:
      "В окружении production CORS_ORIGINS должен содержать явно заданные источники",
    REDIS_DATABASE:
      "Номер базы данных в REDIS_URL должен быть неотрицательным целым числом",
    JWT_SECRET_LENGTH: "Секреты JWT должны содержать не менее 32 символов",
    INVALID_MAIL_DOMAIN:
      "MAIL_DOMAIN должен содержать корректный почтовый домен",
  },

  search: {
    unavailable: "Meilisearch недоступен",
  },

  mail: {
    contentRequired: "Письмо должно содержать текст или HTML",
    providerRejected: "Почтовый провайдер отклонил письмо",
    deliveryIdMissing: "Почтовый провайдер не вернул идентификатор доставки",
    recipientRequired: "Получатель письма не должен быть пустым",
    subjectRequired: "Тема письма не должна быть пустой",
    senders: {
      "no-reply": "Без ответа",
      support: "Поддержка",
      security: "Безопасность",
    },
  },

  logger: {
    unhandledException: "Необработанное исключение",
    unknownError: "Неизвестная ошибка",
    serializationFailedRecord:
      '{"level":"error","message":"Не удалось сериализовать запись лога"}\n',
  },

  jobs: {
    missingDetailsId: "У задачи BullMQ неожиданно отсутствует идентификатор",
    invalidDefinition: "Имя и версия задачи должны быть корректными",
    invalidRetryDelays:
      "Задержки повторных попыток задачи должны быть неотрицательными целыми числами",
    invalidPersistedData: "Некорректные сохранённые данные задачи",
    invalidDelay: "Задержка задачи должна быть неотрицательным целым числом",
    missingQueuedId:
      "BullMQ не назначил идентификатор задаче, добавленной в очередь",
    invalidListRange: "Некорректный диапазон списка задач",
    workerError: "Ошибка обработчика очереди задач",
    missingId: "У задачи BullMQ отсутствует идентификатор",
    invalidPersistedEnvelope: "Некорректная сохранённая оболочка задачи",
    invalidProgress: "Прогресс задачи должен быть целым числом от 0 до 100",
    completed: "Задача выполнена",
    cancelled: "Задача отменена",
    handlerFailed: "Ошибка выполнения обработчика задачи",
    unsupportedState: (state: string) => {
      return `Неподдерживаемое состояние задачи BullMQ '${state}'`
    },
    notFound: (id: string) => {
      return `Задача '${id}' не существует`
    },
    definitionMismatch: (id: string, name: string) => {
      return `Задача '${id}' не соответствует определению '${name}'`
    },
    cannotUpdate: (id: string, state: string) => {
      return `Невозможно обновить задачу '${id}' в состоянии '${state}'`
    },
    cannotRetry: (id: string, state: string) => {
      return `Невозможно повторно запустить задачу '${id}' в состоянии '${state}'`
    },
    invalidEnvelope: (name: string) => {
      return `Некорректная сохранённая оболочка задачи '${name}'`
    },
    handlerNotRegistered: (name: string) => {
      return `Для задачи '${name}' не зарегистрирован обработчик`
    },
    incompatiblePayloadVersion: (name: string) => {
      return `Несовместимая версия данных задачи '${name}'`
    },
    wasCancelled: (id: string) => {
      return `Задача '${id}' была отменена`
    },
    multipleHandlers: (name: string) => {
      return `Для задачи '${name}' зарегистрировано несколько обработчиков`
    },
    handlerMethodRequired: (name: string) => {
      return `Обработчик задачи '${name}' должен предоставлять метод handle()`
    },
  },

  database: {
    invalidObjectId: "Некорректный идентификатор",
    unavailable: "Соединение с MongoDB недоступно",
  },

  cache: {
    unexpectedHealthValue:
      "Проверка работоспособности кеша вернула неожиданное значение",
    healthAndCleanupFailed:
      "Не удалось проверить работоспособность кеша и удалить проверочные данные",
  },

  security: {
    invalidBcryptRounds:
      "Количество раундов bcrypt должно быть положительным безопасным целым числом",

    userNotAuthenticated: "Пользователь не авторизован",
    roleNotAllowed: "Роль пользователя не даёт доступа",
    accessTokenRequired: "Требуется токен доступа",
    accessTokenInvalid: "Токен доступа недействителен",
    refreshTokenInvalid: "Токен обновления недействителен",
  },
  image: {
    emptyUpload: "Загружаемое изображение не должно быть пустым",
    unsupportedMimeType: "Неподдерживаемый MIME-тип изображения",
    byteLimitExceeded:
      "Размер загружаемого изображения превышает лимит в байтах",
    unsupportedDecodedMimeType:
      "Неподдерживаемый MIME-тип содержимого изображения",
    mimeTypeMismatch: "MIME-тип изображения не соответствует его содержимому",
    dimensionsUnavailable: "Не удалось определить размеры изображения",
    dimensionLimitExceeded: "Размеры изображения превышают допустимый лимит",
    processingFailed: "Не удалось обработать загруженное изображение",
    exactlyOneFileRequired: "Требуется ровно один файл изображения",
    missingField: (field: string) => {
      return `Отсутствует поле изображения '${field}'`
    },
  },
  storage: {
    objectSizeUnavailable: "Не удалось определить размер объекта хранилища",
    objectBodyUnavailable: "Содержимое объекта хранилища недоступно",
    configurationRequired:
      "Необходимо настроить URL, регион и учётные данные Garage",
    invalidEndpointUrl: "GARAGE_URL должен содержать корректный URL HTTP(S)",
    invalidEndpointProtocol:
      "GARAGE_URL должен использовать протокол HTTP или HTTPS",
    operations: {
      initializeBucket: "инициализация бакета",
      upload: "загрузка",
      download: "скачивание",
      delete: "удаление",
      checkExistence: "проверка существования",
      createReadUrl: "создание ссылки для чтения",
      createWriteUrl: "создание ссылки для записи",
    },
    commandFailed: (command: string) => {
      return `Ошибка выполнения команды хранилища ${command}`
    },

    bucketMissing: (bucket: string) => {
      return `Бакет хранилища '${bucket}' не существует, автоматическое создание отключено`
    },
    operationFailed: (operation: string, path: string) => {
      return `Не удалось выполнить операцию хранилища '${operation}' для '${path}'`
    },
  },
} as const

export { DICTIONARY }
