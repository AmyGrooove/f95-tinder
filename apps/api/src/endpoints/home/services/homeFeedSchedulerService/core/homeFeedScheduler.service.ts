import { Injectable } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"

import { HomeFeedService } from "@endpoints/home/services/homeFeedService"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { LoggerService } from "@infrastructure/logger/services/loggerService"

import { HOME_FEED_SCHEDULE } from "../../../static/HOME_FEED_SCHEDULE"

@Injectable()
class HomeFeedSchedulerService {
  constructor(
    private readonly homeFeedService: HomeFeedService,
    private readonly loggerService: LoggerService,
  ) {}

  @Cron(`0 0 ${HOME_FEED_SCHEDULE.hour} * * *`, {
    timeZone: HOME_FEED_SCHEDULE.timeZone,
    waitForCompletion: true,
  })
  async prepareFeed() {
    try {
      await this.homeFeedService.getFeed()
    } catch (error) {
      this.loggerService.error(DICTIONARY.home.prepareFeedFailed, error, {
        context: HomeFeedSchedulerService.name,
      })
    }
  }
}

export { HomeFeedSchedulerService }
