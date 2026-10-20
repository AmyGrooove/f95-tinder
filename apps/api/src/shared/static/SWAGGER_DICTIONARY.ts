const SWAGGER_DICTIONARY = {
  health: {
    tag: "Работоспособность",
    getHealth: {
      summary: "Получить состояние работоспособности API",
      description: "Состояние работоспособности зависимостей",
    },
    getLiveness: {
      summary: "Проверить доступность API",
      description: "HTTP API отвечает на запросы",
    },
  },
  errorEnvelope: {
    code: "Машиночитаемый код ошибки",
    message: "Текст ошибки; зависит от причины отказа",
    messageExample: "Текст ошибки",
    details:
      "Дополнительные сведения или null. При ошибке валидации содержит errors — массив сообщений",
    requestId: "Идентификатор запроса для поиска в логах",
  },
} as const

export { SWAGGER_DICTIONARY }
