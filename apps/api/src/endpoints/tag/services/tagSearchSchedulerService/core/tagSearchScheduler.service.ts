import { Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { JobService } from "@infrastructure/jobs/services/jobService"
import { LoggerService } from "@infrastructure/logger/services/loggerService"

import { SYNC_TAG_SEARCH_JOB } from "../../../static/SYNC_TAG_SEARCH_JOB"

@Injectable()
class TagSearchSchedulerService implements OnApplicationBootstrap {
  constructor(
    private readonly jobService: JobService,
    private readonly loggerService: LoggerService,
  ) {}

  async onApplicationBootstrap() {
    await this.enqueue()
  }

  @Cron("0 0 * * 1", { waitForCompletion: true, timeZone: "UTC" })
  async enqueue() {
    try {
      await this.jobService.add(SYNC_TAG_SEARCH_JOB, null, {
        deduplication: { id: SYNC_TAG_SEARCH_JOB.name },
      })
    } catch (error) {
      this.loggerService.error(DICTIONARY.tag.searchEnqueueFailed, error, {
        context: TagSearchSchedulerService.name,
      })
    }
  }
}

export { TagSearchSchedulerService }
