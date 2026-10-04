const DICTIONARY = {
  common: {
    dateNotSpecified: 'Не указана',
  },
  pages: {
    library: {
      title: 'Библиотека',
    },
    notFound: {
      code: '404',
      title: 'Ошибка',
      description: 'Страница не найдена',
      goToMain: 'На главную',
    },
    serverError: {
      code: '500',
      title: 'Ошибка',
      description: 'Проблема на сервере',
      reload: 'Обновить страницу',
      goToMain: 'На главную',
    },
    unauthorized: {
      code: '401',
      title: 'Требуется авторизация',
      authorize: 'Авторизоваться',
      goToMain: 'На главную',
    },
    forbidden: {
      code: '403',
      title: 'Доступ запрещен',
      goToMain: 'На главную',
    },
    settings: {
      title: 'Настройки',
    },
    swipe: {
      title: 'Свайп',
    },
  },
} as const

export { DICTIONARY }
