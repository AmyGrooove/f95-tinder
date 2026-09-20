import { InjectQueue } from "@nestjs/bullmq"
import { Injectable } from "@nestjs/common"
import type { Queue } from "bullmq"

import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"

@Injectable()
class JobsHealthService {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly jobsQueue: Queue,
  ) {}

  async checkHealth() {
    await this.jobsQueue.getJobCounts()
    return true
  }
}

export { JobsHealthService }
