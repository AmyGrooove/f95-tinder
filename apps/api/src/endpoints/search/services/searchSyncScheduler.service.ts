import { Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { JobService } from "@infrastructure/jobs/services/job.service"
import { LoggerService } from "@infrastructure/logger/services/logger.service"

import { SYNC_SEARCH_JOB } from "../static/SYNC_SEARCH_JOB"

@Injectable()
class SearchSyncSchedulerService implements OnApplicationBootstrap {
  constructor(
    private readonly jobService: JobService,
    private readonly loggerService: LoggerService,
  ) {}

  async onApplicationBootstrap() {
    await this.enqueue()
  }

  @Cron("0 */5 * * * *", { waitForCompletion: true })
  async enqueue() {
    try {
      await this.jobService.add(SYNC_SEARCH_JOB, null, {
        deduplication: { id: SYNC_SEARCH_JOB.name },
      })
    } catch (error) {
      this.loggerService.error(DICTIONARY.search.enqueueFailed, error, {
        context: SearchSyncSchedulerService.name,
      })
    }
  }
}

export { SearchSyncSchedulerService }
