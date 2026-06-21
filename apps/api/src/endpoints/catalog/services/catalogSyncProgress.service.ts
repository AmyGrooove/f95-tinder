import { Injectable, type MessageEvent } from '@nestjs/common';
import type {
  CatalogSyncEvent,
  CatalogSyncStatus,
} from '@f95/contracts';
import { concat, defer, from, map, Observable, Subject } from 'rxjs';

import type { SyncStateDocument } from '../../../entities/syncState/schemas/syncState.schema';
import { SyncStateRepository } from '../../../entities/syncState/services/syncState.repository';

function toStatus(state: SyncStateDocument): CatalogSyncStatus {
  const progressPercent =
    state.totalPages && state.totalPages > 0
      ? Math.min(100, Math.round((state.currentPage / state.totalPages) * 100))
      : null;

  return {
    phase: state.phase,
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    processedGames: state.processedGames,
    progressPercent,
    nextRetryAt: state.nextRetryAt?.toISOString() ?? null,
    error: state.lastError,
  };
}

@Injectable()
export class CatalogSyncProgressService {
  private readonly events = new Subject<CatalogSyncEvent>();

  constructor(
    private readonly syncStateRepository: SyncStateRepository,
  ) {}

  async getStatus(): Promise<CatalogSyncStatus> {
    return toStatus(await this.syncStateRepository.getOrCreate());
  }

  publish(state: SyncStateDocument): void {
    this.events.next({
      type: 'progress',
      data: toStatus(state),
    });
  }

  stream(): Observable<MessageEvent> {
    const snapshot = defer(() => from(this.getStatus())).pipe(
      map((data) => ({
        type: 'snapshot',
        data: { type: 'snapshot', data } satisfies CatalogSyncEvent,
      })),
    );
    const updates = this.events.pipe(
      map((event) => ({
        type: event.type,
        data: event,
      })),
    );

    return concat(snapshot, updates);
  }
}
