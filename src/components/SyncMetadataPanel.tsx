import type { MetadataSyncState } from '../f95/types'

type SyncMetadataPanelProps = {
  metadataSyncState: MetadataSyncState
  autoSyncEnabled?: boolean
  onStartSync?: () => void
}

const SyncMetadataPanel = ({
  metadataSyncState,
  autoSyncEnabled = true,
  onStartSync,
}: SyncMetadataPanelProps) => {
  const hasSyncResult =
    metadataSyncState.syncedCount > 0 || metadataSyncState.trackedCount > 0

  const statusText = metadataSyncState.isRunning
    ? `Сканирую ${metadataSyncState.currentPage} / ${metadataSyncState.pageLimit || '-'}`
    : metadataSyncState.error
    ? 'Ошибка синхронизации'
    : hasSyncResult
    ? autoSyncEnabled
      ? 'Автосинхронизация завершена'
      : 'Ручная синхронизация завершена'
    : !autoSyncEnabled
    ? 'Ожидает ручного запуска'
    : metadataSyncState.trackedCount > 0
    ? 'Автосинхронизация завершена'
    : 'Метаданные в порядке'

  return (
    <div className="panel">
      <div className="sectionTitleRow">
        <div className="sectionTitle">Синхронизация метаданных</div>
      </div>
      <div className="smallText" style={{ marginTop: 8 }}>
        {autoSyncEnabled
          ? "Теги, обложки и свежие `version/ts` подтягиваются автоматически для tracked-списков."
          : "Автоматическая синхронизация отключена. Обновление метаданных запускается вручную, чтобы не упираться в rate limit F95."}
      </div>
      {!autoSyncEnabled ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          После проверки обновившиеся игры помечаются плашкой `Обновилось` в
          дашборде.
        </div>
      ) : null}

      {onStartSync ? (
        <div className="settingsActions">
          <button
            className="button"
            type="button"
            onClick={onStartSync}
            disabled={metadataSyncState.isRunning}
          >
            {metadataSyncState.isRunning
              ? "Синхронизирую..."
              : "Запустить синхронизацию"}
          </button>
        </div>
      ) : null}

      <div className="smallText" style={{ marginTop: 8 }}>
        Статус: {statusText}
      </div>
      {metadataSyncState.isRunning || hasSyncResult ? (
        <div className="smallText" style={{ marginTop: 4 }}>
          Синхронизировано: {metadataSyncState.syncedCount} / {metadataSyncState.trackedCount || '-'}
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
