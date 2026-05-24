import { useEffect, useMemo, useState } from "react"
import type { MetadataSyncState } from "../f95/types"

type SyncMetadataPanelProps = {
  metadataSyncState: MetadataSyncState
  autoSyncEnabled?: boolean
  hasConfiguredCookies?: boolean
  onContinueSync?: () => void
  onRefreshSync?: () => void
  onPauseSync?: () => void
  onResumeSync?: () => void
  onStopSync?: () => void
  onClearCatalogData?: () => void
}

const formatRetryCountdown = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) {
    return `${seconds} сек.`
  }

  return seconds > 0 ? `${minutes} мин. ${seconds} сек.` : `${minutes} мин.`
}

const isRateLimitMessage = (message: string | null) => {
  return message?.toLowerCase().includes("network error: 429") === true
}

const SyncMetadataPanel = ({
  metadataSyncState,
  autoSyncEnabled = true,
  hasConfiguredCookies,
  onContinueSync,
  onRefreshSync,
  onPauseSync,
  onResumeSync,
  onStopSync,
  onClearCatalogData,
}: SyncMetadataPanelProps) => {
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now())
  const hasInlineRetryWait =
    metadataSyncState.isRunning &&
    metadataSyncState.phase === "retrying" &&
    metadataSyncState.nextRetryAtUnixMs !== null
  const hasScheduledRetry = metadataSyncState.nextRetryAtUnixMs !== null
  const hasSyncResult =
    metadataSyncState.syncedCount > 0 || metadataSyncState.currentPage > 0
  const retryCountdownText = useMemo(() => {
    if (metadataSyncState.nextRetryAtUnixMs === null) {
      return null
    }

    return formatRetryCountdown(
      metadataSyncState.nextRetryAtUnixMs - currentTimeMs,
    )
  }, [currentTimeMs, metadataSyncState.nextRetryAtUnixMs])
  const shouldShowCookieRateLimitHint =
    hasConfiguredCookies === false &&
    isRateLimitMessage(metadataSyncState.error)
  const progressPercent =
    metadataSyncState.pageLimit > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (metadataSyncState.currentPage / metadataSyncState.pageLimit) *
                100,
            ),
          ),
        )
      : null

  useEffect(() => {
    if (metadataSyncState.nextRetryAtUnixMs === null) {
      return
    }

    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [metadataSyncState.nextRetryAtUnixMs])

  const statusText = metadataSyncState.isStopping
    ? "Останавливаю синхронизацию..."
    : metadataSyncState.isPaused
      ? `Пауза на ${metadataSyncState.currentPage} / ${metadataSyncState.pageLimit || "-"}`
      : metadataSyncState.phase === "warming"
        ? `Набираю первые карточки ${metadataSyncState.swipableCount} / 20`
        : metadataSyncState.phase === "throttled"
          ? "Короткая пауза между страницами"
          : hasInlineRetryWait
            ? "Жду окно для повторной попытки синхронизации"
            : metadataSyncState.isRunning
              ? `Сканирую ${metadataSyncState.currentPage} / ${metadataSyncState.pageLimit || "-"}`
              : hasScheduledRetry
                ? "Автоповтор синхронизации уже запланирован"
                : metadataSyncState.lastOutcome === "stopped"
                  ? "Синхронизация остановлена пользователем"
                  : metadataSyncState.error
                    ? "Ошибка синхронизации"
                    : metadataSyncState.isCatalogStale
                      ? "Каталог устарел"
                      : hasSyncResult && !metadataSyncState.isComplete
                        ? "Есть сохраненный прогресс, синхронизация будет продолжена"
                        : hasSyncResult
                          ? autoSyncEnabled
                            ? "Каталог latest синхронизирован"
                            : "Ручная синхронизация завершена"
                          : !autoSyncEnabled
                            ? "Ожидает ручного запуска"
                            : "Ожидает первого автосинка"

  return (
    <div className="panel">
      <div className="sectionTitleRow">
        <div className="sectionTitle">Синхронизация latest</div>
      </div>
      <div className="smallText" style={{ marginTop: 8 }}>
        {autoSyncEnabled
          ? "При запуске приложение продолжает незавершенный полный проход, а после полного прохода проверяет свежие страницы через sort=date."
          : "Полный проход `latest_data.php` запускается вручную и обновляет локальный каталог свайпа с throttling по страницам."}
      </div>
      <div className="smallText" style={{ marginTop: 4 }}>
        Данные парсера хранятся бессрочно и удаляются только кнопкой очистки.
      </div>
      <div className="smallText" style={{ marginTop: 4 }}>
        При 429 приложение повторит запрос через 30 сек., потом через 60 сек., 5
        минут, 10 минут и дальше каждые 10 минут.
      </div>
      {!autoSyncEnabled ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          После проверки обновившиеся игры помечаются плашкой `Обновилось` в
          списках.
        </div>
      ) : null}

      {onContinueSync || onRefreshSync ? (
        <div className="settingsActions">
          {!metadataSyncState.isRunning && onContinueSync ? (
            <button
              className="button"
              type="button"
              onClick={onContinueSync}
              disabled={metadataSyncState.isComplete}
            >
              Продолжить синхронизацию
            </button>
          ) : null}
          {!metadataSyncState.isRunning && onRefreshSync ? (
            <button
              className="button"
              type="button"
              onClick={onRefreshSync}
              disabled={!metadataSyncState.isComplete}
              title={
                metadataSyncState.isComplete
                  ? "Проверить свежие страницы через sort=date"
                  : "Обновление доступно только после полного прохода парсера"
              }
            >
              Обновить данные
            </button>
          ) : null}
          {metadataSyncState.isRunning && onPauseSync && onResumeSync ? (
            <button
              className="button"
              type="button"
              onClick={metadataSyncState.isPaused ? onResumeSync : onPauseSync}
              disabled={metadataSyncState.isStopping}
            >
              {metadataSyncState.isPaused ? "Продолжить" : "Пауза"}
            </button>
          ) : null}
          {metadataSyncState.isRunning && onStopSync ? (
            <button
              className="button buttonDanger"
              type="button"
              onClick={onStopSync}
              disabled={metadataSyncState.isStopping}
            >
              {metadataSyncState.isStopping ? "Останавливаю..." : "Остановить"}
            </button>
          ) : null}
          {!metadataSyncState.isRunning && onClearCatalogData ? (
            <button
              className="button buttonDanger"
              type="button"
              onClick={onClearCatalogData}
            >
              Очистить данные парсера
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="smallText" style={{ marginTop: 8 }}>
        Статус: {statusText}
      </div>
      {retryCountdownText ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          Следующая попытка через: {retryCountdownText}
        </div>
      ) : null}
      {shouldShowCookieRateLimitHint ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          Подсказка: без cookies F95 чаще режет запросы. Добавь cookies во
          вкладке `Куки`, чтобы синхронизация была стабильнее.
        </div>
      ) : null}
      {metadataSyncState.isRunning || hasSyncResult ? (
        <div className="syncProgressPanel">
          <div className="syncProgressHeader">
            <span>Прогресс обновления</span>
            <span>
              {progressPercent === null ? "..." : `${progressPercent}%`}
            </span>
          </div>
          <div className="syncProgressTrack">
            <div
              className={`syncProgressFill ${
                progressPercent === null ? "syncProgressFillIndeterminate" : ""
              }`}
              style={
                progressPercent === null
                  ? undefined
                  : { width: `${progressPercent}%` }
              }
            />
          </div>
        </div>
      ) : null}
      {metadataSyncState.isRunning || hasSyncResult ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          Сохранено игр: {metadataSyncState.syncedCount}
        </div>
      ) : null}
      {metadataSyncState.isRunning || hasSyncResult ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          Доступно для свайпа: {metadataSyncState.swipableCount}
        </div>
      ) : null}
      {metadataSyncState.duplicateCount > 0 ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          Дубликатов страниц/игр: {metadataSyncState.duplicateCount}
        </div>
      ) : null}
      {metadataSyncState.isRunning ||
      metadataSyncState.updatedTrackedCount > 0 ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          Обновлено tracked-игр: {metadataSyncState.updatedTrackedCount}
        </div>
      ) : null}
      {metadataSyncState.error ? (
        <div
          className="smallText"
          style={{ color: "var(--danger)", marginTop: 4 }}
        >
          {metadataSyncState.error}
        </div>
      ) : null}
      {metadataSyncState.diagnostics.length > 0 ? (
        <div className="smallText" style={{ marginTop: 8 }}>
          {metadataSyncState.diagnostics.slice(-5).map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export { SyncMetadataPanel }
