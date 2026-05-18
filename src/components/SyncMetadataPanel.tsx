import type { MetadataSyncState } from '../f95/types'

type SyncMetadataPanelProps = {
  metadataSyncState: MetadataSyncState
  autoSyncEnabled?: boolean
  onStartSync?: () => void
  onPauseSync?: () => void
  onResumeSync?: () => void
  onStopSync?: () => void
  onClearCatalogData?: () => void
}

const SyncMetadataPanel = ({
  metadataSyncState,
  autoSyncEnabled = true,
  onStartSync,
  onPauseSync,
  onResumeSync,
  onStopSync,
  onClearCatalogData,
}: SyncMetadataPanelProps) => {
  const hasInlineRetryWait =
    metadataSyncState.isRunning &&
    metadataSyncState.phase === 'retrying' &&
    metadataSyncState.nextRetryAtUnixMs !== null
  const hasScheduledRetry = metadataSyncState.nextRetryAtUnixMs !== null
  const hasSyncResult =
    metadataSyncState.syncedCount > 0 || metadataSyncState.currentPage > 0
  const progressPercent =
    metadataSyncState.pageLimit > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (metadataSyncState.currentPage / metadataSyncState.pageLimit) * 100,
            ),
          ),
        )
      : null

  const statusText = metadataSyncState.isStopping
    ? 'Останавливаю синхронизацию...'
    : metadataSyncState.isPaused
    ? `Пауза на ${metadataSyncState.currentPage} / ${metadataSyncState.pageLimit || '-'}`
    : metadataSyncState.phase === 'warming'
    ? `Набираю первые карточки ${metadataSyncState.swipableCount} / 20`
    : metadataSyncState.phase === 'throttled'
    ? 'Короткая пауза между страницами'
    : hasInlineRetryWait
    ? 'Жду окно для повторной попытки синхронизации'
    : metadataSyncState.isRunning
    ? `Сканирую ${metadataSyncState.currentPage} / ${metadataSyncState.pageLimit || '-'}`
    : hasScheduledRetry
    ? 'Автоповтор синхронизации уже запланирован'
    : metadataSyncState.lastOutcome === 'stopped'
    ? 'Синхронизация остановлена пользователем'
    : metadataSyncState.error
    ? 'Ошибка синхронизации'
    : metadataSyncState.isCatalogStale
    ? 'Каталог устарел'
    : hasSyncResult && !metadataSyncState.isComplete
    ? 'Есть сохраненный прогресс, синхронизация будет продолжена'
    : hasSyncResult
    ? autoSyncEnabled
      ? 'Каталог latest синхронизирован'
      : 'Ручная синхронизация завершена'
    : !autoSyncEnabled
    ? 'Ожидает ручного запуска'
    : 'Ожидает первого автосинка'

  return (
    <div className="panel">
      <div className="sectionTitleRow">
        <div className="sectionTitle">Синхронизация latest</div>
      </div>
      <div className="smallText" style={{ marginTop: 8 }}>
        {autoSyncEnabled
          ? "При запуске и изменении фильтров приложение проходит `latest_data.php` с начала, собирает локальный каталог для свайпа и обновляет tracked-игры."
          : "Полный проход `latest_data.php` запускается вручную и обновляет локальный каталог свайпа с throttling по страницам."}
      </div>
      <div className="smallText" style={{ marginTop: 4 }}>
        Страницы идут последовательно с короткой адаптивной паузой; при rate limit используется Retry-After или backoff.
      </div>
      <div className="smallText" style={{ marginTop: 4 }}>
        Актуальность каталога держится 7 дней. Старые данные парсера очищаются и собираются заново, списки пользователя не трогаются.
      </div>
      {!autoSyncEnabled ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          После проверки обновившиеся игры помечаются плашкой `Обновилось` в
          списках.
        </div>
      ) : null}

      {onStartSync ? (
        <div className="settingsActions">
          {!metadataSyncState.isRunning ? (
            <button className="button" type="button" onClick={onStartSync}>
              Запустить синхронизацию
            </button>
          ) : null}
          {metadataSyncState.isRunning && onPauseSync && onResumeSync ? (
            <button
              className="button"
              type="button"
              onClick={
                metadataSyncState.isPaused ? onResumeSync : onPauseSync
              }
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
      {metadataSyncState.isRunning || metadataSyncState.updatedTrackedCount > 0 ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          Обновлено tracked-игр: {metadataSyncState.updatedTrackedCount}
        </div>
      ) : null}
      {metadataSyncState.error ? (
        <div className="smallText" style={{ color: 'var(--danger)', marginTop: 4 }}>
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
