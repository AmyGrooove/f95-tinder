import { useCallback, useState } from 'react'
import type { MetadataSyncState } from '../f95/types'

type SyncMetadataPanelProps = {
  metadataSyncState: MetadataSyncState
  startMetadataSync: (pageLimit: number) => Promise<void>
}

const SyncMetadataPanel = ({
  metadataSyncState,
  startMetadataSync,
}: SyncMetadataPanelProps) => {
  const [pageLimitInput, setPageLimitInput] = useState(20)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleStartSync = useCallback(async () => {
    if (metadataSyncState.isRunning) {
      return
    }

    const parsedLimit = Math.max(1, Math.floor(Number(pageLimitInput) || 1))
    setIsSubmitting(true)
    try {
      await startMetadataSync(parsedLimit)
    } finally {
      setIsSubmitting(false)
    }
  }, [metadataSyncState.isRunning, pageLimitInput, startMetadataSync])

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="sectionTitleRow">
        <div className="sectionTitle">Синхронизация метаданных</div>
      </div>
      <div className="smallText" style={{ marginTop: 8 }}>
        Подтяните теги/обложки из кэша без изменения списков.
      </div>

      <div className="formRow" style={{ marginTop: 12 }}>
        <div className="label">Синхронизировать страницы</div>
        <input
          className="input"
          type="number"
          min={1}
          value={pageLimitInput}
          onChange={(event) => setPageLimitInput(Number(event.target.value))}
        />
      </div>

      <button
        className="button buttonPrimary"
        onClick={handleStartSync}
        disabled={metadataSyncState.isRunning || isSubmitting}
      >
        {metadataSyncState.isRunning ? 'Синхронизация...' : 'Синхронизировать'}
      </button>

      <div className="smallText" style={{ marginTop: 8 }}>
        Статус: {metadataSyncState.currentPage} / {metadataSyncState.pageLimit || "-"}
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
