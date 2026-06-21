import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Interval } from '@nestjs/schedule';
import type { Queue } from 'bullmq';

import {
  GAME_DECISION_FLUSH_JOB,
  GAME_DECISION_FLUSH_QUEUE,
} from '../jobs/jobs.module';

const FLUSH_INTERVAL_MILLISECONDS = 60 * 1_000;
const FLUSH_JOB_ID = 'scheduled-game-decision-flush';

@Injectable()
export class GameDecisionFlushScheduler {
  constructor(
    @InjectQueue(GAME_DECISION_FLUSH_QUEUE)
    private readonly queue: Queue,
  ) {}

  @Interval(FLUSH_INTERVAL_MILLISECONDS)
  async scheduleFlush(): Promise<void> {
    await this.queue.add(
      GAME_DECISION_FLUSH_JOB,
      {},
      {
        jobId: FLUSH_JOB_ID,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}
