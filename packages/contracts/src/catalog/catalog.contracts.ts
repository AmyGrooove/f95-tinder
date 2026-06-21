import type { IsoDateTime } from '../common/error.contracts.js';

export type CatalogSyncPhase =
  | 'idle'
  | 'initial-import'
  | 'daily-sync'
  | 'retrying'
  | 'completed'
  | 'failed';

export interface CatalogSyncStatus {
  phase: CatalogSyncPhase;
  currentPage: number;
  totalPages: number | null;
  processedGames: number;
  progressPercent: number | null;
  nextRetryAt: IsoDateTime | null;
  error: string | null;
}

export type CatalogSyncEventType = 'snapshot' | 'progress';

export interface CatalogSyncEvent {
  type: CatalogSyncEventType;
  data: CatalogSyncStatus;
}
