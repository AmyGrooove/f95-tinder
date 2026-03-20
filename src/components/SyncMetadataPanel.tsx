import type { MetadataSyncState } from '../f95/types'

type SyncMetadataPanelProps = {
  metadataSyncState: MetadataSyncState
}

const SyncMetadataPanel = ({
  metadataSyncState,
}: SyncMetadataPanelProps) => {
  const statusText = metadataSyncState.isRunning
    ? `Сканирую ${metadataSyncState.currentPage} / ${metadataSyncState.pageLimit || '-'}`
    : metadataSyncState.error
    ? 'Ошибка синхронизации'
    : metadataSyncState.trackedCount > 0
    ? 'Автосинхронизация завершена'
    : 'Метаданные в порядке'

  return (
    <div className="panel">
      <div className="sectionTitleRow">
        <div className="sectionTitle">Синхронизация метаданных</div>
      </div>
      <div className="smallText" style={{ marginTop: 8 }}>
        Теги и обложки подтягиваются автоматически, когда в списках есть
        неполные карточки.
      </div>

      <div className="smallText" style={{ marginTop: 8 }}>
        Статус: {statusText}
      </div>
      <div className="smallText" style={{ marginTop: 4 }}>
        Синхронизировано: {metadataSyncState.syncedCount} / {metadataSyncState.trackedCount || '-'}
      </div>
      {metadataSyncState.error ? (
        <div className="smallText" style={{ color: 'var(--danger)', marginTop: 4 }}>
          {metadataSyncState.error}
        </div>
      ) : null}
    </div>
  )
}

export { SyncMetadataPanel }
