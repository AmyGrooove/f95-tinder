# F95 Tinder (Electron)

## Запуск
1) pnpm i
2) pnpm dev

`pnpm dev` теперь сам поднимает Vite renderer и открывает Electron.

## Production
1) `pnpm build`
2) `pnpm start`

## Windows .exe
1) `pnpm dist`
2) Готовый portable `.exe` появится в `release/`

## Важно
- Проект больше не поддерживает browser-only запуск. Если открыть renderer напрямую в браузере, приложение покажет заглушку и попросит стартовать Electron.
- В dev-режиме Vite нужен только как источник renderer для Electron.
- Сессия, настройки и каталог `latest` сохраняются в Electron JSON-файлы (`local-lists.json`, `local-settings.json`, `latest-catalog.json`).
- Приложение не скачивает и не распаковывает игры. В дашборде можно только вручную пометить игру как скачанную.
- Для доступа к данным F95 можно создать `.env` рядом с `package.json`:

```env
F95_COOKIE="xf_user=...; xf_session=...; xf_csrf=..."
```

- После этого перезапустите `pnpm dev`.
- Либо откройте `Настройки -> Куки` и вставьте `F95_COOKIE`, `cookies.txt`, JSON или таблицу из DevTools. В этом случае локальный proxy подхватит куки сразу, без перезапуска dev-сервера.

## Страницы
- Свайп: основной режим (Left мусор, Right избранное, Enter открыть, Backspace/Z undo).
- Дашборд: статистика и список игр из избранного и мусора с обложкой и названием.

## Просмотр скринов
- Клик по скрину или cover открывает fullscreen viewer.
- В fullscreen: Esc закрыть, Left/Right перелистывание, кнопки ‹ ›.
