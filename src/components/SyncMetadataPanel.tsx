import type { MetadataSyncState } from '../f95/types'

type SyncMetadataPanelProps = {
  metadataSyncState: MetadataSyncState
  autoSyncEnabled?: boolean
  onStartSync?: () => void
  onPauseSync?: () => void
  onResumeSync?: () => void
  onStopSync?: () => void
}

const SyncMetadataPanel = ({
  metadataSyncState,
  autoSyncEnabled = true,
  onStartSync,
  onPauseSync,
  onResumeSync,
  onStopSync,
}: SyncMetadataPanelProps) => {
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
    : metadataSyncState.isRunning
    ? `Сканирую ${metadataSyncState.currentPage} / ${metadataSyncState.pageLimit || '-'}`
    : metadataSyncState.lastOutcome === 'stopped'
    ? 'Синхронизация остановлена пользователем'
    : metadataSyncState.error
    ? 'Ошибка синхронизации'
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
          ? "При запуске приложение проходит `latest_data.php` по дефолтным фильтрам, собирает локальный каталог для свайпа и обновляет tracked-игры."
          : "Полный проход `latest_data.php` запускается вручную и обновляет локальный каталог свайпа с throttling по страницам."}
      </div>
      <div className="smallText" style={{ marginTop: 4 }}>
        Внутри блока страницы идут подряд, а после каждого блока из 10 страниц делается пауза 10 секунд, чтобы не упираться в rate limit F95.
      </div>
      <div className="smallText" style={{ marginTop: 4 }}>
        Актуальность каталога держится 2 дня: если `latest-catalog.json` свежее, при запуске повторный полный обход не нужен.
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
    </div>
  )
}

export { SyncMetadataPanel }
