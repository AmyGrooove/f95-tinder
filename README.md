# Bisky

- [Документация проекта](apps/api/public/docs/readme.md) — реализация API, продуктовые требования, планы и исследования
- [Контекст разработки API](apps/api/agents/index.md) и [веб-приложения](apps/web/agents/index.md) — точки входа в код

При запущенном API база знаний доступна по пути `/knowledge/` с настроенной Basic-аутентификацией.

## Локальная разработка

При первом запуске скопируйте `apps/api/.env.example` в `apps/api/.env`, а `apps/web/.env.example` в `apps/web/.env.local`. Установите зависимости в обоих приложениях. Запустите Docker Desktop в режиме Linux-контейнеров и выполните из корня репозитория:

```powershell
pnpm dev:docker
```

Эта команда запускает MongoDB, Redis, Meilisearch и Garage, затем настраивает бакет `bisky`. Дальше в двух терминалах из корня запустите dev-серверы:

```powershell
pnpm dev:api
pnpm dev:web
```

Web доступен на [localhost:3001](http://localhost:3001), Swagger — на [localhost:3000/docs](http://localhost:3000/docs), а публичные объекты Garage — на `http://bisky.localhost:3902`. Настройки Resend и Kodik задаются в `apps/api/.env`.

Для остановки инфраструктуры выполните `docker compose stop` из корня. Данные хранятся в именованных томах Docker.
