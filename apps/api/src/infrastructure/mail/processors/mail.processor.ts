import { Processor, WorkerHost } from "@nestjs/bullmq"
import type { Job } from "bullmq"

import { JOBS_QUEUE_NAME } from "@infrastructure/jobs/static/JOBS_QUEUE_NAME"
import type { IQueuedJobData } from "@infrastructure/jobs/types/IQueuedJobData"

import { MailService } from "../services/mail.service"
import { MAIL_JOB_NAME } from "../static/MAIL_JOB_NAME"
import type { ISendMailOptions } from "../types/ISendMailOptions"

@Processor(JOBS_QUEUE_NAME)
class MailProcessor extends WorkerHost {
  constructor(private readonly mailService: MailService) {
    super()
  }

  async process(job: Job<IQueuedJobData<ISendMailOptions>>): Promise<void> {
    if (job.name !== MAIL_JOB_NAME) {
      return
    }

    await this.mailService.deliverDirect(job.data.payload)
  }
}

export { MailProcessor }
