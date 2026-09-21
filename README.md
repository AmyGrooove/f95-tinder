# Bisky

## Локальный запуск в Docker

1. Скопируйте `.env.example` в `.env`.
2. Задайте уникальные секреты и пароли в `.env`. JWT-секреты должны быть длиной не менее 32 символов, а `OPENOBSERVE_PASSWORD` должен содержать строчную и прописную буквы, цифру и специальный символ.
3. Для локального Postal установите `POSTAL_HOSTNAME=postal.localhost` и `POSTAL_WEB_PROTOCOL=http`.
4. Запустите `docker compose up -d`.
5. Для остановки выполните `docker compose down`.

После запуска доступны:

| Сервис | Адрес | Учётные данные |
| --- | --- | --- |
| Web | http://localhost:3001 | Не требуются |
| API Swagger/OpenAPI | http://localhost:3000/docs | Не требуются |
| MinIO Console | http://localhost:9001 | `MINIO_ACCESS_KEY` и `MINIO_ACCESS_SECRET` из `.env` |
| OpenObserve | http://localhost:5080 | `OPENOBSERVE_USERNAME` и `OPENOBSERVE_PASSWORD` из `.env` |
| Postal | http://postal.localhost:5000 | Создайте администратора командой ниже |

Пароли не хранятся в README: все локальные секреты находятся в `.env`, который не добавляется в Git.

## Первичная настройка Postal

Сначала создайте администратора интерактивной командой:

```sh
docker compose exec postal-web /opt/postal/app/bin/postal make-user
```

Затем откройте Postal, создайте Organization и Mail Server. В Mail Server добавьте и подтвердите домен отправки, после чего создайте SMTP Credential. Скопируйте имя пользователя Credential в `SMTP_USER`, а его пароль — в `SMTP_PASSWORD` файла `.env`, затем выполните `docker compose up -d api`.

Пока `SMTP_USER` и `SMTP_PASSWORD` содержат заглушки, API работает, но его `/health` возвращает нездоровый статус для почтовой проверки.
