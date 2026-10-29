# Эндпоинты API

Все фактически подключённые операции — от входа до подборок. Выбери маршрут, чтобы увидеть простую схему, пример запроса, проверки и момент ответа.

<div class="endpoint-overview"><span><strong>40</strong> продуктовых операций</span><span><strong>4</strong> служебных маршрута</span><span>Сверено с кодом · 29 октября 2026</span></div>

<nav class="endpoint-jumps" aria-label="Области API">
<a href="#/api/endpoints?id=auth">Вход и сессии<span>11</span></a>
<a href="#/api/endpoints?id=account">Аккаунт<span>8</span></a>
<a href="#/api/endpoints?id=catalog">Каталог и поиск<span>2</span></a>
<a href="#/api/endpoints?id=library">Личная библиотека<span>8</span></a>
<a href="#/api/endpoints?id=collections">Подборки<span>11</span></a>
<a href="#/api/endpoints?id=service">Служебные маршруты<span>4</span></a>
</nav>

> **Как устроены подробности.** У каждой операции своя схема; общая почтовая джоба, пересчёт вкуса и синхронизация поиска описаны отдельно рядом с вызывающими их сценариями. [Обозначения и правила схем](requestFlows/readme.md).

<h2 id="auth" class="endpoint-group-title">Вход и сессии<span>11</span></h2>
<p class="endpoint-group-description">Регистрация, восстановление доступа и устройства</p>
<div class="endpoint-list" aria-label="Вход и сессии">
<a class="endpoint-row" href="#/api/requestFlows/auth?id=register"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/auth/register</code><span>Создать аккаунт и получить секретный код</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=login"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/auth/login</code><span>Войти по логину и паролю</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=login-code"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/auth/login/code</code><span>Войти по секретному коду</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=reissue-code"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/auth/login/code</code><span>Заменить секретный код и завершить другие сессии</span></span><span class="endpoint-access">Access + код</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=logout"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/auth/logout</code><span>Завершить текущую сессию</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=request-password-reset"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/auth/password/reset</code><span>Запросить письмо для сброса пароля</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=confirm-password-reset"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/auth/password/reset</code><span>Подтвердить сброс и завершить все сессии</span></span><span class="endpoint-access">Код из письма</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=get-sessions"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/auth/session</code><span>Посмотреть активные устройства</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=delete-other-sessions"><span class="endpoint-method endpoint-method--delete">DELETE</span><span class="endpoint-main"><code>/auth/session/others</code><span>Завершить остальные сессии</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=delete-session"><span class="endpoint-method endpoint-method--delete">DELETE</span><span class="endpoint-main"><code>/auth/session/:sessionId</code><span>Завершить выбранную сессию</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/auth?id=refresh-session"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/auth/session/refresh</code><span>Обновить пару токенов</span></span><span class="endpoint-access">Refresh</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
</div>

<h2 id="account" class="endpoint-group-title">Аккаунт<span>8</span></h2>
<p class="endpoint-group-description">Профиль, пароль и подтверждение email</p>
<div class="endpoint-list" aria-label="Аккаунт">
<a class="endpoint-row" href="#/api/requestFlows/account?id=whoami"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/account/whoami</code><span>Узнать текущего пользователя и сессию</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/account?id=display-name"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/account/displayName</code><span>Изменить отображаемое имя</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/account?id=username"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/account/username</code><span>Изменить уникальный логин</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/account?id=password"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/account/password</code><span>Сменить пароль и завершить другие сессии</span></span><span class="endpoint-access">Access + пароль</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/account?id=request-setup"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/account/credentials</code><span>Запросить привязку email и пароля</span></span><span class="endpoint-access">Access + код</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/account?id=confirm-setup"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/account/credentials</code><span>Подтвердить привязку кодом из письма</span></span><span class="endpoint-access">Access + код письма</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/account?id=request-email"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/account/email</code><span>Запросить смену email</span></span><span class="endpoint-access">Access + пароль</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/account?id=confirm-email"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/account/email</code><span>Подтвердить новый email</span></span><span class="endpoint-access">Access + код письма</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
</div>

<h2 id="catalog" class="endpoint-group-title">Каталог и поиск<span>2</span></h2>
<p class="endpoint-group-description">Публичные карточки и поиск по сайту</p>
<div class="endpoint-list" aria-label="Каталог и поиск">
<a class="endpoint-row" href="#/api/requestFlows/catalog?id=item"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/items/:id</code><span>Открыть произведение, его теги и связи</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/catalog?id=search"><span class="endpoint-method endpoint-method--query">QUERY</span><span class="endpoint-main"><code>/search</code><span>Найти произведения, пользователей и подборки</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
</div>

<h2 id="library" class="endpoint-group-title">Личная библиотека<span>8</span></h2>
<p class="endpoint-group-description">Статусы, оценки и попытки просмотра</p>
<div class="endpoint-list" aria-label="Личная библиотека">
<a class="endpoint-row" href="#/api/requestFlows/userItems?id=query"><span class="endpoint-method endpoint-method--query">QUERY</span><span class="endpoint-main"><code>/userItems</code><span>Прочитать краткие собственные записи по ID</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/userItems?id=create"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/userItems</code><span>Добавить произведение в библиотеку</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/userItems?id=skip"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/userItems/skip</code><span>Пропустить произведение на 90 дней</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/userItems?id=block"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/userItems/block</code><span>Исключить произведение бессрочно</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/userItems?id=update"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/userItems/:id</code><span>Изменить статус, оценку, избранное или заметку</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/userItems?id=remove"><span class="endpoint-method endpoint-method--delete">DELETE</span><span class="endpoint-main"><code>/userItems/:id</code><span>Удалить запись вместе с попытками</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/userItems?id=create-attempt"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/userItems/:id/attempts</code><span>Добавить попытку просмотра или прохождения</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/userItems?id=update-attempt"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/userItems/:id/attempts/:attemptId</code><span>Обновить прогресс и даты попытки</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
</div>

<h2 id="collections" class="endpoint-group-title">Подборки<span>11</span></h2>
<p class="endpoint-group-description">Публичное чтение, авторский состав и личные реакции</p>
<div class="endpoint-list" aria-label="Подборки">
<a class="endpoint-row" href="#/api/requestFlows/collections?id=query"><span class="endpoint-method endpoint-method--query">QUERY</span><span class="endpoint-main"><code>/collections</code><span>Получить страницу кратких подборок</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=get"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/collections/:id</code><span>Открыть метаданные и блоки подборки</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=items"><span class="endpoint-method endpoint-method--query">QUERY</span><span class="endpoint-main"><code>/collections/:id/items</code><span>Прочитать страницу произведений подборки</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=filters"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/collections/:id/filters</code><span>Получить доступные фильтры подборки</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=create"><span class="endpoint-method endpoint-method--post">POST</span><span class="endpoint-main"><code>/collections</code><span>Создать подборку и её состав</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=update"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/collections/:id</code><span>Изменить метаданные, блоки и состав</span></span><span class="endpoint-access">Автор</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=remove"><span class="endpoint-method endpoint-method--delete">DELETE</span><span class="endpoint-main"><code>/collections/:id</code><span>Скрыть подборку через soft delete</span></span><span class="endpoint-access">Автор</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=user"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/collections/:id/user</code><span>Прочитать свою реакцию на подборку</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=favorite"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/collections/:id/favorite</code><span>Добавить или убрать из избранного</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=rating"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/collections/:id/rating</code><span>Оценить подборку или очистить оценку</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/collections?id=hidden"><span class="endpoint-method endpoint-method--patch">PATCH</span><span class="endpoint-main"><code>/collections/:id/hidden</code><span>Изменить личный флаг скрытия</span></span><span class="endpoint-access">Access</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
</div>

<h2 id="service" class="endpoint-group-title">Служебные маршруты<span>4</span></h2>
<p class="endpoint-group-description">Состояние приложения, фон страницы и health</p>
<div class="endpoint-list" aria-label="Служебные маршруты">
<a class="endpoint-row" href="#/api/requestFlows/service?id=home"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/</code><span>Показать HTML-страницу состояния</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/service?id=background"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/background</code><span>Загрузить изображение служебной страницы</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/service?id=health"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/health</code><span>Проверить готовность семи зависимостей</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
<a class="endpoint-row" href="#/api/requestFlows/service?id=live"><span class="endpoint-method endpoint-method--get">GET</span><span class="endpoint-main"><code>/health/live</code><span>Проверить, что процесс отвечает</span></span><span class="endpoint-access">Публичный</span><span class="endpoint-arrow" aria-hidden="true">↗</span></a>
</div>

<a id="common"></a>

## Общие правила

- **Публичный** — Bisky cookies не проверяются. **Access** — cookie `__Host-accessToken`, действующий JWT и принадлежащая пользователю неистёкшая UserSession; дополнительные проверки User указаны в сценарии. **Refresh** — cookie `__Host-refreshToken` и сверка сохранённого refresh-хеша. **Автор** — Access и принадлежность Collection. Basic Auth knowledge не заменяет доступ к бизнес-API.
- **QUERY — реальный HTTP-метод**, принимающий JSON-тело. Для примера: `curl -X QUERY http://localhost:3000/search -H "Content-Type: application/json" --data '{"search":"космос"}'`. Не заменяй его GET или POST. Примеры используют вымышленные ID/коды и не содержат рабочих секретов.
- Общий ValidationPipe преобразует DTO и запрещает неизвестные поля. Для изменяющих запросов действует CSRF-проверка; 403 возможен до сервиса. Для подключённых контроллеров действует общий throttling; 429 не означает выполнение операции. Настройка CORS не равнозначна разрешению CSRF.
- Код 204 означает ответ без тела. Успех постановки в очередь не означает завершения джобы или доставки письма. Схемы описывают код; они не подтверждают доступность БД, очередей и внешних сервисов.

## Границы каталога

Состав установлен по AppModule, зарегистрированным контроллерам и их фактическим вызовам: шесть продуктовых HTTP-модулей, AppController и HealthController. RecommendationsModule и TagWeightModifiersModule не добавляют HTTP-маршрутов. Автоматические HEAD для GET и CORS OPTIONS не считаются самостоятельными продуктовыми операциями.

[Knowledge](/knowledge/) и [Swagger](/docs) — интерфейсы документации со статическими ресурсами; отдельные файлы, vendor chunks и Swagger assets не являются карточками сценариев. Knowledge требует своего Basic Auth.

[Устройство API](readme.md) · [Покрытие продуктовых страниц](pages/readme.md) · [Сущности и связи](entities.md)

**Источники состава:** [AppModule](../../src/app/app.module.ts), [AuthModule](../../src/endpoints/auth/auth.module.ts), [AccountModule](../../src/endpoints/account/account.module.ts), [UserItemEndpointModule](../../src/endpoints/userItem/userItem.module.ts), [CollectionEndpointModule](../../src/endpoints/collection/collection.module.ts), [ItemEndpointModule](../../src/endpoints/item/item.module.ts), [SearchEndpointModule](../../src/endpoints/search/search.module.ts), [AppController](../../src/app/controllers/app.controller.ts), [HealthModule](../../src/infrastructure/health/health.module.ts).
