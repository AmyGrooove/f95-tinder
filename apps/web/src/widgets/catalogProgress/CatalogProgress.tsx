import type {
  CatalogSyncPhase,
  CatalogSyncStatus,
} from '@f95/contracts';
import { useEffect, useRef } from 'react';

import { useCatalogSyncStatus } from '../../entities/game/hooks/useCatalogSyncStatus';
import styles from './CatalogProgress.module.scss';

type CatalogProgressProps = {
  compact?: boolean;
  onReady?: () => void;
};

const phaseLabels: Record<CatalogSyncPhase, string> = {
  completed: 'Catalog ready',
  'daily-sync': 'Updating catalog',
  failed: 'Catalog update paused',
  idle: 'Catalog waiting',
  'initial-import': 'Preparing the catalog',
  retrying: 'Catalog retry scheduled',
};

function formatRetryTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getProgressLabel(status: CatalogSyncStatus): string {
  if (status.totalPages !== null) {
    return `Page ${status.currentPage} of ${status.totalPages}`;
  }

  return status.currentPage > 0
    ? `Scanning page ${status.currentPage}`
    : 'Waiting for source pagination';
}

export function CatalogProgress({
  compact = false,
  onReady,
}: CatalogProgressProps) {
  const sync = useCatalogSyncStatus();
  const readyNotifiedRef = useRef(false);

  useEffect(() => {
    if (
      sync.status?.phase === 'completed' &&
      !readyNotifiedRef.current
    ) {
      readyNotifiedRef.current = true;
      onReady?.();
    }
  }, [onReady, sync.status?.phase]);

  if (sync.isLoading) {
    return (
      <section className={`${styles.panel} ${compact ? styles.compact : ''}`}>
        <span className={styles.eyebrow}>Catalog status</span>
        <h2>Checking import progress...</h2>
      </section>
    );
  }

  if (!sync.status) {
    return (
      <section
        className={`${styles.panel} ${styles.error} ${
          compact ? styles.compact : ''
        }`}
        role="alert"
      >
        <span className={styles.eyebrow}>Catalog unavailable</span>
        <h2>Unable to load sync status</h2>
        <button onClick={() => void sync.refetch()} type="button">
          Retry status
        </button>
      </section>
    );
  }

  const status = sync.status;
  const isDeterminate = status.progressPercent !== null;
  const isActive =
    status.phase === 'initial-import' ||
    status.phase === 'daily-sync' ||
    status.phase === 'retrying';

  return (
    <section
      className={`${styles.panel} ${compact ? styles.compact : ''}`}
      aria-live="polite"
    >
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            {sync.isConnected ? 'Live catalog status' : 'Catalog status'}
          </span>
          <h2>{phaseLabels[status.phase]}</h2>
        </div>
        {isDeterminate ? (
          <strong>{status.progressPercent}%</strong>
        ) : null}
      </div>

      {isActive ? (
        isDeterminate ? (
          <progress
            aria-label="Catalog sync progress"
            max={100}
            value={status.progressPercent ?? 0}
          />
        ) : (
          <div
            aria-label="Catalog sync in progress"
            className={styles.indeterminate}
            role="progressbar"
          >
            <span />
          </div>
        )
      ) : null}

      <div className={styles.details}>
        <span>{getProgressLabel(status)}</span>
        <span>{status.processedGames.toLocaleString()} games processed</span>
      </div>

      {status.nextRetryAt ? (
        <p className={styles.retry}>
          Next attempt: {formatRetryTime(status.nextRetryAt)}
        </p>
      ) : null}

      {status.error ? (
        <p className={styles.sourceError} role="status">
          Source error: {status.error}
        </p>
      ) : null}
    </section>
  );
}
