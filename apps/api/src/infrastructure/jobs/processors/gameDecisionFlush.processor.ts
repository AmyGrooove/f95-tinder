import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { GameDecisionWriteBehindService } from '../../database/services/gameDecisionWriteBehind.service';
import {
  GAME_DECISION_FLUSH_JOB,
  GAME_DECISION_FLUSH_QUEUE,
} from '../jobs.module';

@Processor(GAME_DECISION_FLUSH_QUEUE, { concurrency: 1 })
export class GameDecisionFlushProcessor extends WorkerHost {
  constructor(
    private readonly writeBehindService: GameDecisionWriteBehindService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== GAME_DECISION_FLUSH_JOB) {
      return;
    }

    await this.writeBehindService.flushDirtyUsers();
  }
}
