import { Injectable } from "@nestjs/common"

import { JobService } from "@infrastructure/jobs/services/job.service"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

import { SEND_MAIL_JOB } from "../static/SEND_MAIL_JOB"
import type { IMailDeliveryResult } from "../types/IMailDeliveryResult"
import type { ISendMailOptions } from "../types/ISendMailOptions"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class MailService {
  constructor(private readonly jobService: JobService) {}

  async send(options: ISendMailOptions) {
    this.validateOptions(options)

    const payload = {
      ...options,
      attachments: options.attachments?.map((attachment) => ({
        ...attachment,
        content: Buffer.isBuffer(attachment.content)
          ? attachment.content.toString("base64")
          : attachment.content,
        isBuffer: Buffer.isBuffer(attachment.content),
      })),
    }
    const id = await this.jobService.add(SEND_MAIL_JOB, payload)

    return { id, status: "queued" } satisfies IMailDeliveryResult
  }

  private validateOptions(options: ISendMailOptions) {
    if (
      isNil(options.to) ||
      (isString(options.to)
        ? options.to.trim() === ""
        : options.to.length === 0)
    ) {
      throw new Error(DICTIONARY.mail.recipientRequired)
    }

    if (options.subject.trim() === "") {
      throw new Error(DICTIONARY.mail.subjectRequired)
    }

    const isTextMissing = isNil(options.text) || options.text === ""
    const isHtmlMissing = isNil(options.html) || options.html === ""

    if (isTextMissing && isHtmlMissing) {
      throw new Error(DICTIONARY.mail.contentRequired)
    }
  }
}

export { MailService }
