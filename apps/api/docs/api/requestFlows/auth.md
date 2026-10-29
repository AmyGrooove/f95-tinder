# Авторизация и сессии

Схемы описывают текущие вызовы в исходниках, а не трассировку запущенного API. [Каталог маршрутов](../endpoints.md), [контракт аккаунта](../accountAndAuthSpec.md), [операции аккаунта](account.md).

<a id="common"></a>

## Общие проверки и границы

Все успешные ответы используют `Cache-Control: no-store`. DTO преобразуют входные данные и отклоняют лишние поля. Глобальные CSRF-проверки могут вернуть 403 для изменяющих запросов; ограничение частоты — 429. У регистрации лимит 2 запроса в минуту, у входа, перевыпуска кода и сброса пароля — 5; остальные операции используют общий лимит 100 в минуту. Лимиты относятся к IP.

**Access-доступ** означает проверку `__Host-accessToken`: подпись, срок, тип JWT и ObjectId в `sub/sessionId`; затем конкретный use case проверяет принадлежащую пользователю `UserSession` с `expiresAt > now`. Проверка пользователя указана отдельно в каждом потоке. Bearer guard здесь не используется. **Refresh-доступ** использует `__Host-refreshToken` и сохранённый SHA-256 хеш текущего refresh-токена.

Контроллер устанавливает/очищает cookies только после успешного завершения сервиса. Обе cookies имеют `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`; access живёт 10 минут, refresh — 120 дней. Токены и хеши не попадают в JSON. Создание сессии определяет страну IP локально через GeoIP, без внешнего запроса. Обновление сессии страну и устройство не меняет.

В этих 11 потоках нет публикации прикладных событий. Фоновая работа есть только у запроса сброса пароля: прямая постановка `mail.send` в очередь, без промежуточного события. У остальных операций нет очередей, джоб и внешних вызовов. Ошибки MongoDB/Redis вне специально обработанных ветвей распространяются через общий HTTP-обработчик; отдельная транзакция MongoDB не объединяет Redis, cookies и отправку ответа.

**Общие исходники:** [подключение модулей](../../../src/app/app.module.ts), [AuthModule](../../../src/endpoints/auth/auth.module.ts), [AccountModule](../../../src/endpoints/account/account.module.ts), [HTTP-настройки](../../../src/app/functions/configureApplication/core/configureApplication.ts), [JWT](../../../src/infrastructure/security/services/jwt.service.ts), [cookies](../../../src/infrastructure/security/services/cookie.service.ts), [UserRepository](../../../src/entities/user/services/user.repository.ts), [UserSessionRepository](../../../src/entities/userSession/services/userSession.repository.ts), [MongoWriteRepository](../../../src/infrastructure/database/services/mongoWrite.repository.ts), [MongoBulkRepository](../../../src/infrastructure/database/services/mongoBulk.repository.ts), [транзакции](../../../src/infrastructure/database/services/mongoTransaction.service.ts), [GeoIP](../../../src/entities/userSession/functions/getCountryByIp/core/getCountryByIp.ts).

<a id="register"></a>

## POST /auth/register

Создаёт аккаунт без email/пароля и сразу открывает сессию. Доступ без авторизации; тело не требуется. Пример: `POST /auth/register` → `201 {"username":"quietfox042","accessCode":"AbCdEfGhIjKlMnOpQrStUvWxYz012345"}` и обе auth-cookies. Код в примере вымышленный.

```mermaid
flowchart TD
    accTitle: Регистрация аккаунта
    accDescr: Пользователь и его первая сессия создаются одной транзакцией, после commit возвращаются логин, секретный код и cookies.
    A(["POST /auth/register"]):::http --> B["Сгенерировать логин и секретный код"]:::action
    subgraph TX["Транзакция MongoDB"]
        C[("Создать User с хешем кода")]:::data --> D["Выпустить access и refresh JWT"]:::action
        D --> E[("Создать UserSession с хешем refresh")]:::data
    end
    B --> C
    E -->|Commit| F["Установить обе cookies"]:::action
    F --> G(["201: username и accessCode"]):::http
```

**Данные и проверки:** `UserRepository.createNew` генерирует логин/displayName и 24 случайных байта в виде 32-символьного base64url кода; хранит SHA-256 `accessCodeHash`. `AuthService.createSession` создаёт `UserSession` с userAgent, страной, сроком 120 дней и SHA-256 refresh-хешем. Другие сущности, включая UserSettings, этот поток не создаёт.

**Согласованность и ошибки:** `AuthService.register` повторяет всю регистрацию при конфликте уникального username, максимум 10 попыток; затем 503. Другие ошибки не преобразуются в этот 503. При ошибке внутри транзакции User и UserSession откатываются вместе. Ответ отправляется после commit и установки cookies; фона нет. Ошибка отправки ответа после commit не удаляет созданный аккаунт. Общие 403/429 описаны выше.

**Исходники:** [AuthController.register](../../../src/endpoints/auth/controllers/auth.controller.ts), [AuthService.register/createSession](../../../src/endpoints/auth/services/auth.service.ts), [ответ](../../../src/endpoints/auth/dto/response/register.response.ts), общие репозитории и транзакции выше.

<a id="login"></a>

## POST /auth/login

Вход по логину и паролю после настройки аккаунта, без текущей авторизации. Пример: `{"username":"quietfox042","password":"Example-pass-123"}` → `204` без тела и обе auth-cookies.

```mermaid
flowchart TD
    accTitle: Вход по паролю
    accDescr: Проверяется пароль пользователя, создаётся новая сессия и возвращаются cookies без завершения других сессий.
    A(["POST /auth/login"]):::http --> B["Проверить DTO и нормализовать логин"]:::action
    B --> C[("Прочитать User и хеш пароля")]:::data
    C --> D["Сравнить пароль с хешем"]:::action
    D --> E["Выпустить access и refresh JWT"]:::action
    E --> F[("Создать UserSession")]:::data
    F --> G["Установить обе cookies"]:::action
    G --> H(["204 без тела"]):::http
```

**Данные и проверки:** username обрезается по краям и приводится к нижнему регистру, соответствует `^[a-z0-9_]+$`; пароль — минимум 8 символов, максимум 72 UTF-8 байта, без нормализации. Читаются id, role и passwordHash User; bcrypt проверяет пароль. Создаётся одна UserSession; остальные сохраняются.

**Ошибки и ответ:** неизвестный логин, отсутствие пароля и неверный пароль дают одинаковый 401; DTO — 400, общие 403/429. Транзакции нет: HTTP ждёт сохранения сессии, затем устанавливает cookies. Фона нет; ошибка после сохранения сессии не откатывает её.

**Исходники:** [AuthController.login](../../../src/endpoints/auth/controllers/auth.controller.ts), [AuthService.login/createSession](../../../src/endpoints/auth/services/auth.service.ts), [LoginBodyDto](../../../src/endpoints/auth/dto/body/login.body.ts).

<a id="login-code"></a>

## POST /auth/login/code

Вход по секретному коду до установки пароля, без текущей авторизации. Пример: `{"accessCode":"AbCdEfGhIjKlMnOpQrStUvWxYz012345"}` → `204` без тела и обе auth-cookies.

```mermaid
flowchart TD
    accTitle: Вход по секретному коду
    accDescr: По хешу кода ищется пользователь без пароля, затем создаётся новая сессия и возвращаются cookies.
    A(["POST /auth/login/code"]):::http --> B["Проверить формат кода"]:::action
    B --> C[("Найти User по хешу кода без пароля")]:::data
    C --> D["Выпустить access и refresh JWT"]:::action
    D --> E[("Создать UserSession")]:::data
    E --> F["Установить обе cookies"]:::action
    F --> G(["204 без тела"]):::http
```

**Данные и проверки:** код — ровно 32 case-sensitive символа base64url; `UserRepository.findByAccessCode` ищет SHA-256 хеш вместе с `passwordHash:null` и выбирает только id/role. Логин не требуется. Новая UserSession создаётся с userAgent и локально определённой страной; остальные сессии сохраняются. Секретный код при входе не расходуется.

**Ошибки и ответ:** неверный код и аккаунт с паролем — одинаковый 401; формат/лишние поля — 400, общие 403/429. Транзакции и фона нет. HTTP ждёт сохранения сессии; ошибка после записи не удаляет её.

**Исходники:** [AuthController.loginByCode](../../../src/endpoints/auth/controllers/auth.controller.ts), [AuthService.loginByCode/createSession](../../../src/endpoints/auth/services/auth.service.ts), [LoginCodeBodyDto](../../../src/endpoints/auth/dto/body/loginCode.body.ts), [UserRepository.findByAccessCode](../../../src/entities/user/services/user.repository.ts).

<a id="reissue-code"></a>

## PATCH /auth/login/code

Перевыпускает секретный код до установки пароля. Требует access-cookie, действующую собственную сессию и текущий код. Пример: `{"accessCode":"AbCdEfGhIjKlMnOpQrStUvWxYz012345"}` → `200 {"accessCode":"ZyXwVuTsRqPoNmLkJiHgFeDcBa543210"}` и новые auth-cookies.

```mermaid
flowchart TD
    accTitle: Перевыпуск секретного кода
    accDescr: Новый код, обновление текущей сессии и удаление остальных сессий сохраняются одной транзакцией перед ответом.
    A(["PATCH /auth/login/code"]):::http --> B["Проверить DTO и access JWT"]:::action
    subgraph TX["Транзакция MongoDB"]
        C[("Заменить хеш кода User при совпадении старого")]:::data --> D["Выпустить новые JWT"]:::action
        D --> E[("Обновить действующую UserSession")]:::data
        E --> F[("Удалить остальные UserSession пользователя")]:::data
    end
    B --> C
    F -->|Commit| G["Установить обе cookies"]:::action
    G --> H(["200: новый accessCode"]):::http
```

**Данные и проверки:** `UserRepository.reissueAccessCode` атомарно проверяет userId, SHA-256 старого кода и `passwordHash:null`, записывает хеш нового случайного кода. `updateRefreshToken` проверяет принадлежность и явный срок текущей сессии, меняет refresh-хеш, expiresAt на 120 дней и lastRefreshedAt. Её id/userAgent/country сохраняются; `deleteOthers` удаляет все остальные сессии, включая истёкшие.

**Ошибки и ответ:** неверный код, наличие пароля, отсутствующая/истёкшая сессия или JWT — 401; DTO — 400, общие 403/429. Проверка активной сессии здесь выполняется условной записью внутри транзакции, без отдельного предварительного чтения. Ошибка до commit откатывает все изменения; cookies меняются после commit. Параллельное использование старого кода не позволяет обоим запросам успешно заменить его. Фона нет.

**Исходники:** [AccountCredentialsController.reissueCode](../../../src/endpoints/account/controllers/accountCredentials.controller.ts), [AuthService.reissueCode](../../../src/endpoints/auth/services/auth.service.ts), [LoginCodeBodyDto](../../../src/endpoints/auth/dto/body/loginCode.body.ts), [ответ](../../../src/endpoints/auth/dto/response/loginCode.response.ts).

<a id="logout"></a>

## POST /auth/logout

Завершает текущую сессию. Требует действующий access JWT и соответствующую активную UserSession. Пример: `POST /auth/logout` с access-cookie, без тела → `204`, обе cookies очищены.

```mermaid
flowchart TD
    accTitle: Выход из текущей сессии
    accDescr: После проверки access JWT удаляется только собственная активная сессия и очищаются cookies.
    A(["POST /auth/logout"]):::http --> B["Проверить access JWT и ObjectId"]:::action
    B --> C[("Удалить активную собственную UserSession")]:::data
    C --> D["Очистить обе cookies"]:::action
    D --> E(["204 без тела"]):::http
```

**Данные и проверки:** одна атомарная `deleteActive` фильтрует sessionId, userId и `expiresAt > now`. User отдельно не читается; остальные сессии сохраняются. Транзакции, событий и фона нет.

**Ошибки и ответ:** неверный/истёкший access JWT, отсутствующая/истёкшая сессия и повторный logout — 401, cookies при этом не очищаются. Истёкший access требует сначала refresh. Общие 403/429. HTTP ждёт удаления; если ответ теряется после записи, сессия уже удалена.

**Исходники:** [AuthController.logout](../../../src/endpoints/auth/controllers/auth.controller.ts), [AuthService.logout](../../../src/endpoints/auth/services/auth.service.ts), [UserSessionRepository.deleteActive](../../../src/entities/userSession/services/userSession.repository.ts).

<a id="request-password-reset"></a>

## POST /auth/password/reset

Запрашивает код сброса на подтверждённый email, без авторизации. Пример: `{"email":"reader@example.com"}` → `204` без тела; ответ одинаков для существующего и неизвестного адреса, действующего cooldown и обработанной ошибки постановки письма.

```mermaid
flowchart TD
    accTitle: Запрос сброса пароля
    accDescr: При отсутствии cooldown читается аккаунт, Redis сохраняет подтверждение для подходящего пользователя и ожидается постановка письма; доставка идёт фоном.
    A(["POST /auth/password/reset"]):::http --> B["Проверить email"]:::action
    B --> C[("Проверить cooldown в Redis")]:::data
    C --> D{"Можно повторить запрос?"}:::action
    D -->|Нет| R(["204 без тела"]):::http
    D -->|Да| E[("Прочитать User с email и passwordHash")]:::data
    E --> F[("Атомарно сохранить cooldown и возможное подтверждение в Redis")]:::data
    F --> G{"Подтверждение сохранено?"}:::action
    G -->|Нет| R
    G -->|Да| Q{{"Добавить mail.send в очередь"}}:::queue
    Q -->|Добавлено| R
    Q -->|Ошибка постановки| K[("Условно удалить подтверждение, сохранить cooldown")]:::data
    K --> R
    Q -.->|Воркер| J[["Джоба mail.send"]]:::job
    J --> X[/"Отправить письмо через Resend"/]:::external
```

**Данные и проверки:** email обрезается и приводится к нижнему регистру, максимум 254 символа. Ключ Redis — `<appName>:auth:passwordReset:{<sha256(email)>}`, рядом `:cooldown`. Для User с email и passwordHash сохраняются userId, email, исходный passwordHash, bcrypt codeHash шестизначного кода и 3 попытки на 4 часа; cooldown — 60 секунд. Неизвестный/неподходящий аккаунт получает только cooldown. Lua повторно проверяет cooldown атомарно; новый принятый запрос заменяет прежний код.

**Ответ и сбои:** MongoDB не изменяется, транзакции нет. HTTP ожидает `MailService.send` → `JobService.add`, но не доставку. Ошибка enqueue логируется, условно удаляется только подтверждение с тем же codeHash; cooldown остаётся, а ответ всё равно 204. Ошибка cleanup тоже только логируется. Ошибки Redis вне mail catch не скрываются. DTO — 400, общие 403/429. Принятый queue job не доказывает получение письма. Фоновый обработчик описан ниже.

**Исходники:** [PasswordResetController.requestPasswordReset](../../../src/endpoints/auth/controllers/passwordReset.controller.ts), [PasswordResetService.requestReset](../../../src/endpoints/auth/services/passwordReset.service.ts), [PasswordResetBodyDto](../../../src/endpoints/auth/dto/body/passwordReset.body.ts), [Lua и сроки](../../../src/endpoints/auth/static/PASSWORD_RESET.ts), [IPasswordReset](../../../src/endpoints/auth/types/IPasswordReset.ts).

<a id="confirm-password-reset"></a>

## PATCH /auth/password/reset

Устанавливает новый пароль по email и коду из письма, без access-сессии. Пример: `{"email":"reader@example.com","code":"012345","newPassword":"Example-new-123"}` → `204` без тела, обе cookies очищены.

```mermaid
flowchart TD
    accTitle: Подтверждение сброса пароля
    accDescr: Код расходуется атомарно в Redis, после чего пароль и удаление всех сессий сохраняются транзакцией MongoDB; затем cookies очищаются.
    A(["PATCH /auth/password/reset"]):::http --> B["Проверить DTO и код"]:::action
    B --> C[("Погасить подтверждение в Redis")]:::data
    C --> D["Хешировать новый пароль"]:::action
    subgraph TX["Транзакция MongoDB"]
        E[("Заменить пароль User при совпадении email и старого хеша")]:::data --> F[("Удалить все UserSession пользователя")]:::data
    end
    D --> E
    F -->|Commit| G["Очистить обе cookies"]:::action
    G --> R(["204 без тела, нужен новый вход"]):::http
```

**Данные и проверки:** email нормализуется как при запросе; code — строка из 6 цифр, новый пароль — минимум 8 символов и максимум 72 UTF-8 байта. `ConfirmationService.consume` читает pending, проверяет поля/попытки/email/userId и bcrypt codeHash; Lua атомарно расходует именно текущее подтверждение или уменьшает попытки, не продлевая TTL. Третья ошибка удаляет подтверждение; параллельный запрос не может погасить заменённый код.

**Согласованность и ошибки:** после расходования кода `replacePassword` условно проверяет исходные userId/email/passwordHash. Затем в той же MongoDB-транзакции удаляются все сессии, включая истёкшие. Несовпадение состояния, неверный/истёкший/погашенный код — 400; общие 403/429. Ошибка БД откатывает пароль и удаление сессий вместе, но не восстанавливает Redis-код: требуется новый запрос сброса. Cookies очищаются только после commit, фона нет.

**Исходники:** [PasswordResetController.confirmPasswordReset](../../../src/endpoints/auth/controllers/passwordReset.controller.ts), [PasswordResetService.confirmReset/consumeReset](../../../src/endpoints/auth/services/passwordReset.service.ts), [DTO](../../../src/endpoints/auth/dto/body/confirmPasswordReset.body.ts), [ConfirmationService.consume](../../../src/endpoints/auth/services/confirmation.service.ts), [CONFIRMATION_SCRIPT](../../../src/endpoints/auth/static/CONFIRMATION_SCRIPT.ts), [UserRepository.replacePassword](../../../src/entities/user/services/user.repository.ts).

<a id="get-sessions"></a>

## GET /auth/session

Возвращает собственные действующие сессии. Требует access JWT, существующего User и текущую сессию среди активных. Пример: `GET /auth/session` с access-cookie → `200 [{"id":"507f1f77bcf86cd799439011","userAgent":null,"country":"unknown","createdAt":"2026-10-29T10:00:00.000Z","expiresAt":"2027-02-26T10:00:00.000Z","lastRefreshedAt":null,"isCurrent":true}]`.

```mermaid
flowchart TD
    accTitle: Список сессий
    accDescr: По access JWT параллельно проверяется пользователь и читаются его активные сессии, затем проверяется присутствие текущей сессии и возвращается массив.
    A(["GET /auth/session"]):::http --> B["Проверить access JWT"]:::action
    B --> C[("Проверить существование User")]:::data
    B --> D[("Прочитать активные UserSession пользователя")]:::data
    C --> E["Проверить User и присутствие текущей сессии"]:::action
    D --> E
    E --> F["Сформировать разрешённые поля и ISO-даты"]:::action
    F --> R(["200: массив сессий"]):::http
```

**Данные и проверки:** `findActiveByUser` выбирает только публичные поля с `expiresAt > now`, сортирует createdAt и id по убыванию. Ответ содержит также country и isCurrent, без токенов и хешей. Чтения User и UserSession идут параллельно, без транзакции/общего snapshot; записи, события и фон отсутствуют.

**Ошибки и ответ:** невалидный JWT, отсутствующий User или текущая сессия — 401; общий лимит — 429. HTTP ждёт обоих чтений и маппинга, cookies сохраняются.

**Исходники:** [SessionController.getSessions](../../../src/endpoints/auth/controllers/session.controller.ts), [SessionService.getSessions](../../../src/endpoints/auth/services/session.service.ts), [UserSessionRepository.findActiveByUser](../../../src/entities/userSession/services/userSession.repository.ts), [SessionResponseDto](../../../src/endpoints/auth/dto/response/session.response.ts).

<a id="delete-other-sessions"></a>

## DELETE /auth/session/others

Завершает остальные сессии аккаунта. Требует access JWT, существующего User и активную собственную текущую сессию. Пример: `DELETE /auth/session/others` без тела с access-cookie → `204` без тела; текущие cookies сохранены.

```mermaid
flowchart TD
    accTitle: Завершение остальных сессий
    accDescr: После проверки пользователя и текущей сессии удаляются все остальные сессии того же пользователя.
    A(["DELETE /auth/session/others"]):::http --> B["Проверить access JWT"]:::action
    B --> C[("Прочитать текущую UserSession и проверить User")]:::data
    C --> D["Проверить действующую собственную сессию"]:::action
    D --> E[("Удалить остальные UserSession пользователя")]:::data
    E --> R(["204: текущие cookies сохранены"]):::http
```

**Данные и проверки:** существование User и текущая UserSession проверяются параллельно; `deleteOthers` использует userId и `_id != currentSessionId`, удаляет в том числе истёкшие записи. Отсутствие других сессий — успешный результат. Статический маршрут `others` объявлен перед `:sessionId`.

**Ошибки и ответ:** нарушение авторизации — 401; общие 403/429. Отдельной транзакции между проверкой и deleteMany нет; уже выполняющиеся запросы не отменяются. HTTP ждёт удаления, cookies не меняет; событий и фона нет.

**Исходники:** [SessionController.deleteOtherSessions](../../../src/endpoints/auth/controllers/session.controller.ts), [SessionService.deleteOtherSessions](../../../src/endpoints/auth/services/session.service.ts), [UserSessionRepository.deleteOthers](../../../src/entities/userSession/services/userSession.repository.ts).

<a id="delete-session"></a>

## DELETE /auth/session/:sessionId

Завершает выбранную собственную сессию. Требует access JWT, существующего User и активную текущую сессию. Пример: `DELETE /auth/session/507f1f77bcf86cd799439011` с access-cookie → `204` без тела; при удалении текущей сессии обе cookies очищены.

```mermaid
flowchart TD
    accTitle: Завершение выбранной сессии
    accDescr: Удаляется только активная сессия того же пользователя; cookies очищаются, если удалена текущая сессия.
    A(["DELETE /auth/session/:sessionId"]):::http --> B["Проверить ObjectId и access JWT"]:::action
    B --> C[("Прочитать текущую UserSession и проверить User")]:::data
    C --> D[("Удалить активную собственную целевую UserSession")]:::data
    D --> E{"Это текущая сессия?"}:::action
    E -->|Да| F["Очистить обе cookies"]:::action
    E -->|Нет| R(["204 без тела"]):::http
    F --> R
```

**Данные и проверки:** `MongoObjectIdHandler` проверяет 24 hex-символа параметра. После параллельной проверки User/текущей сессии `deleteActive` атомарно фильтрует целевой id, owner и срок. Сравнение target с JWT sessionId определяет очистку cookies.

**Ошибки и ответ:** неправильный id — 400; нет авторизации — 401; чужая, отсутствующая или истёкшая целевая сессия — одинаковый 404; общие 403/429. Транзакции между предварительной проверкой и удалением нет. HTTP ждёт удаления; фона нет, потеря ответа не восстанавливает запись.

**Исходники:** [SessionController.deleteSession](../../../src/endpoints/auth/controllers/session.controller.ts), [SessionService.deleteSession](../../../src/endpoints/auth/services/session.service.ts), [MongoObjectIdHandler](../../../src/infrastructure/database/handlers/mongoObjectId.handler.ts), [UserSessionRepository.deleteActive](../../../src/entities/userSession/services/userSession.repository.ts).

<a id="refresh-session"></a>

## PATCH /auth/session/refresh

Ротирует токены и продлевает текущую сессию. Требует refresh-cookie и соответствующий текущий серверный refresh-хеш; действующий access не нужен. Пример: `PATCH /auth/session/refresh` с refresh-cookie, без тела → `204` без тела и обе новые auth-cookies.

```mermaid
flowchart TD
    accTitle: Обновление токенов
    accDescr: После проверки refresh JWT и чтения актуальной роли пользователя одна условная запись заменяет refresh-хеш действующей сессии, затем устанавливаются cookies.
    A(["PATCH /auth/session/refresh"]):::http --> B["Проверить refresh JWT и ObjectId"]:::action
    B --> C[("Прочитать User и текущую role")]:::data
    C --> D["Выпустить новые JWT"]:::action
    D --> E[("Заменить refresh-хеш активной UserSession при совпадении старого")]:::data
    E --> F["Установить обе cookies"]:::action
    F --> R(["204 без тела"]):::http
```

**Данные и проверки:** `updateRefreshToken` фильтрует id, userId, `expiresAt > now` и SHA-256 переданного refresh; записывает новый хеш, срок 120 дней и lastRefreshedAt. JWT refresh содержит случайный jti, поэтому новый токен отличается даже в ту же секунду. Устройство/страна/id сессии и остальные сессии сохраняются.

**Ошибки и ответ:** неверный JWT/ObjectId, отсутствующий User, истёкшая сессия, повторное/параллельное использование прежнего refresh — 401 без установки или очистки cookies; общие 403/429. Одна атомарная запись, без отдельной MongoDB-транзакции и фона. Cookies устанавливаются после успешной ротации; потеря ответа не откатывает новый хеш, старый refresh уже недействителен.

**Исходники:** [SessionController.refresh](../../../src/endpoints/auth/controllers/session.controller.ts), [SessionService.refresh](../../../src/endpoints/auth/services/session.service.ts), [UserSessionRepository.updateRefreshToken](../../../src/entities/userSession/services/userSession.repository.ts), JWT/cookies в общих исходниках.

<a id="mail-job"></a>

## Общий фон: доставка письма

`POST /auth/password/reset`, `POST /account/credentials` и `POST /account/email` напрямую вызывают `MailService.send`, который проверяет адрес/тему/содержимое и **ожидает** `JobService.add(SEND_MAIL_JOB, payload)`. Результат `queued` и queue id не означают доставку. Каждая HTTP-схема показывает собственную ветку отказа постановки; фоновый сбой не меняет уже отправленный HTTP-ответ и автоматически не удаляет подтверждение.

```mermaid
flowchart TD
    accTitle: Доставка писем подтверждения
    accDescr: Очередь передаёт письмо фоновому обработчику, который проверяет отмену и вызывает Resend; HTTP не ожидает эту работу.
    Q{{"Очередь jobs: mail.send"}}:::queue -.-> J[["Джоба mail.send, версия 2"]]:::job
    J --> C["Проверить содержимое и отмену"]:::action
    C --> X[/"Resend: отправить письмо с ключом идемпотентности"/]:::external
    X --> R["Проверить provider error и delivery id"]:::action
```

`SendMailJobHandler.handle` использует ключ идемпотентности `mail.send:<queueJobId>`; ошибки провайдера или отсутствие delivery id завершают попытку ошибкой. Определение джобы задаёт повторы через 1, 5 и 30 секунд, всего до 4 попыток; отмена и unrecoverable-ошибки обрабатываются процессором отдельно. Воркер может начать работу до или после HTTP-ответа; подтверждение фактического получения письма пользователем здесь не отслеживается. При успехе результат джобы — `{id: providerDeliveryId, status:"sent"}`. Событий и MongoDB-записей в обработчике нет.

**Исходники:** [MailService.send](../../../src/infrastructure/mail/services/mail.service.ts), [JobService.add](../../../src/infrastructure/jobs/services/job.service.ts), [SEND_MAIL_JOB](../../../src/infrastructure/mail/static/SEND_MAIL_JOB.ts), [SendMailJobHandler.handle](../../../src/infrastructure/mail/handlers/sendMailJob.handler.ts), [JobProcessorService](../../../src/infrastructure/jobs/services/jobProcessor.service.ts).
