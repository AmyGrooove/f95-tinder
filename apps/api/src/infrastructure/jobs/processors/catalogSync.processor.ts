import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import {
  CatalogSyncService,
  type CatalogSyncKind,
} from '../../../endpoints/catalog/services/catalogSync.service';
import { F95IntegrationError } from '../../../integrations/f95/errors/f95Integration.error';
import { DistributedLockService } from '../../cache/services/distributedLock.service';
import {
  CATALOG_SYNC_JOB,
  CATALOG_SYNC_QUEUE,
} from '../jobs.module';

interface CatalogSyncJobData {
  kind: CatalogSyncKind;
  retryAttempt?: number;
}

const RETRY_DELAYS = [1, 5, 15, 30].map(
  (minutes) => minutes * 60 * 1_000,
);
const SYNC_LOCK_KEY = 'sync-lock:f95-latest';
const SYNC_LOCK_TTL = 5 * 60 * 1_000;
const SYNC_LOCK_REFRESH_INTERVAL = 60 * 1_000;
const MAX_RETRY_DELAY = 24 * 60 * 60 * 1_000;

@Processor(CATALOG_SYNC_QUEUE, { concurrency: 1 })
export class CatalogSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(CatalogSyncProcessor.name);

  constructor(
    private readonly catalogSyncService: CatalogSyncService,
    private readonly distributedLockService: DistributedLockService,
    @InjectQueue(CATALOG_SYNC_QUEUE)
    private readonly queue: Queue<CatalogSyncJobData>,
  ) {
    super();
  }

  async process(job: Job<CatalogSyncJobData>): Promise<void> {
    if (job.name !== CATALOG_SYNC_JOB) {
      return;
    }

    const lock = await this.distributedLockService.acquire(
      SYNC_LOCK_KEY,
      SYNC_LOCK_TTL,
    );

    if (!lock) {
      return;
    }

    const refreshTimer = setInterval(() => {
      void this.distributedLockService
        .refresh(lock, SYNC_LOCK_TTL)
        .catch(() => undefined);
    }, SYNC_LOCK_REFRESH_INTERVAL);
    refreshTimer.unref();

    try {
      await this.catalogSyncService.run(job.data.kind);
    } catch (error) {
      const retryAttempt = (job.data.retryAttempt ?? 0) + 1;
      const configuredBackoff =
        RETRY_DELAYS[Math.min(retryAttempt - 1, RETRY_DELAYS.length - 1)];
      const integrationError =
        error instanceof F95IntegrationError ? error : null;
      const delay = Math.min(
        Math.max(
          configuredBackoff,
          integrationError?.retryAfterMilliseconds ?? 0,
        ),
        MAX_RETRY_DELAY,
      );
      const nextRetryAt = new Date(Date.now() + delay);

      this.logger.warn({
        event: 'catalog_sync_retry_scheduled',
        jobId: job.id,
        syncKind: job.data.kind,
        retryAttempt,
        retryDelayMilliseconds: delay,
        errorCode: integrationError?.code,
        statusCode: integrationError?.metadata.statusCode,
        page: integrationError?.metadata.page,
      });

      await this.catalogSyncService.markRetry(
        error,
        retryAttempt,
        nextRetryAt,
      );
      await this.queue.add(
        CATALOG_SYNC_JOB,
        { ...job.data, retryAttempt },
        {
          delay,
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } finally {
      clearInterval(refreshTimer);
      await this.distributedLockService.release(lock);
    }
  }
}
