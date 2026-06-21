import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { CronJob } from 'cron';

import { GameRepository } from '../../entities/game/services/game.repository';
import { SyncStateRepository } from '../../entities/syncState/services/syncState.repository';
import type { CatalogSyncKind } from '../../endpoints/catalog/services/catalogSync.service';
import { ConfigService } from '../config/config.service';
import {
  CATALOG_SYNC_JOB,
  CATALOG_SYNC_QUEUE,
} from '../jobs/jobs.module';

interface CatalogSyncJobData {
  kind: CatalogSyncKind;
  retryAttempt?: number;
}

const DAILY_SYNC_CRON_NAME = 'catalog-daily-sync';

@Injectable()
export class CatalogSyncScheduler implements OnApplicationBootstrap {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly syncStateRepository: SyncStateRepository,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectQueue(CATALOG_SYNC_QUEUE)
    private readonly queue: Queue<CatalogSyncJobData>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const [gameCount, syncState] = await Promise.all([
      this.gameRepository.count(),
      this.syncStateRepository.getOrCreate(),
    ]);
    const initialImportIncomplete =
      syncState.lastSuccessfulSyncAt === null &&
      syncState.phase !== 'completed';

    if (gameCount === 0 || initialImportIncomplete) {
      await this.enqueue('initial');
    }

    const cronJob = new CronJob(this.configService.catalogSyncCron, () => {
      void this.enqueue('daily');
    });

    this.schedulerRegistry.addCronJob(DAILY_SYNC_CRON_NAME, cronJob);
    cronJob.start();
  }

  private async enqueue(kind: CatalogSyncKind): Promise<void> {
    await this.queue.add(
      CATALOG_SYNC_JOB,
      { kind, retryAttempt: 0 },
      {
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}
