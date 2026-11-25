const SWAGGER_DICTIONARY = {
  valueFilter: {
    caseInsensitiveIds: "Идентификаторы уникальны без учёта регистра",
  },
  health: {
    tag: "Работоспособность",
    getHealth: {
      summary: "Получить состояние работоспособности API",
      operationDescription:
        "Проверяет работоспособность API и его зависимостей",
      description: "Состояние работоспособности зависимостей",
      unavailable:
        "Проверка одной или нескольких зависимостей завершилась отказом либо приложение завершает работу",
    },
    getLiveness: {
      summary: "Проверить доступность API",
      operationDescription: "Подтверждает, что API отвечает на запросы",
      description: "HTTP API отвечает на запросы",
    },
  },
  headers: {
    cacheControl: "Политика хранения ответа в кеше",
    acceptQuery: "Поддерживаемый формат тела QUERY-запроса",
    retryAfter:
      "Время до снятия ограничения в секундах при срабатывании общего лимита запросов",
    rateLimit: "Лимит запросов за окно для этой операции",
    rateRemaining: "Число оставшихся запросов в текущем окне",
    rateReset: "Время до конца текущего окна в секундах",
  },
  internalError: "Внутренняя ошибка при обработке запроса",
  rateLimitExceeded: "Превышен лимит запросов",
  errorEnvelope: {
    code: "Машиночитаемый код ошибки",
    message: "Текст ошибки; зависит от причины отказа",
    messageExample: "Текст ошибки",
    details:
      "Дополнительные сведения или null. При ошибке валидации содержит errors — массив сообщений",
    requestId: "Идентификатор запроса для поиска в логах",
    requestIdExample: "req-1",
  },
} as const

export { SWAGGER_DICTIONARY }
