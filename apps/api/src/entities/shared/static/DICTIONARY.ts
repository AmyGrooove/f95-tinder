const DICTIONARY = {
  auth: {
    invalidCredentials: "Секретный код недействителен",
    unauthorized: "Авторизация отсутствует или недействительна",
    usernameUnavailable:
      "Не удалось создать уникальный логин, повторите запрос",
  },
  source: {
    repeatedPage: "Повторилось состояние пагинации при сборе данных источника",
    invalidPageNumber:
      "Номер страницы должен быть положительным безопасным целым числом",
  },
  kodik: {
    sourceNotFound: "Источник Kodik не найден в справочнике источников",
    searchRequired:
      "Необходимо указать название или идентификатор для поиска Kodik",
    requestFailed: "Не удалось получить ответ API Kodik",
    invalidResponse: "API Kodik вернул некорректный ответ",
    invalidPageUrl: "API Kodik вернул недопустимую ссылку пагинации",
  },
  kodikMovies: {
    jobNotFound: "Задача сбора фильмов Kodik не найдена",
    repeatedPage: "API Kodik повторил страницу пагинации",
    collecting: "Сбор новых фильмов",
    announcements: "Перепроверка анонсов",
    completed: "Сбор завершён",
  },
} as const

export { DICTIONARY }
