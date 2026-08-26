import { Injectable } from "@nestjs/common"

import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"

import { MailService } from "../services/mail.service"
import { MAIL_JOB_NAME } from "../static/MAIL_JOB_NAME"
import type { ISendMailOptions } from "../types/ISendMailOptions"

@Injectable()
@JobHandler(MAIL_JOB_NAME, { attempts: 3, retryDelay: 1_000, concurrency: 5 })
class SendMailJobHandler {
  constructor(private readonly mailService: MailService) {}

  handle(_id: string, payload: ISendMailOptions) {
    return this.mailService.deliverDirect(payload)
  }
}

export { SendMailJobHandler }
