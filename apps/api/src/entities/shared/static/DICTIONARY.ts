const DICTIONARY = {
  collection: {
    invalidAuthor: "Автор обязателен только для пользовательской подборки",
    automaticSiteOnly: "Автоматические подборки доступны только сайту",
    rulesRequired: "Автоматическая подборка требует условий отбора",
    manualRules:
      "Условия автоматического отбора допустимы только для типа auto",
    automaticGroups: "Автоматическая подборка не поддерживает ручные группы",
    orderedFeatureValue:
      "Сравнение по порядку допустимо только для числа или даты",
  },
  tagRelation: {
    selfRelation: "Тег не может быть связан сам с собой",
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
