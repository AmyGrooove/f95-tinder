import { Injectable } from "@nestjs/common"

import { JobService } from "@infrastructure/jobs/services/job.service"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

import { SEND_MAIL_JOB } from "../static/SEND_MAIL_JOB"
import type { IMailDeliveryResult } from "../types/IMailDeliveryResult"
import type { ISendMailOptions } from "../types/ISendMailOptions"

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
      throw new Error("Mail recipient must not be empty")
    }

    if (options.subject.trim() === "") {
      throw new Error("Mail subject must not be empty")
    }

    if (
      options.idempotencyKey !== undefined &&
      (!isString(options.idempotencyKey) ||
        options.idempotencyKey.trim() === "" ||
        options.idempotencyKey.length > 256)
    ) {
      throw new Error("Mail idempotency key must be 1 to 256 characters")
    }

    const isTextMissing = isNil(options.text) || options.text === ""
    const isHtmlMissing = isNil(options.html) || options.html === ""

    if (isTextMissing && isHtmlMissing) {
      throw new Error("Mail content must include text or HTML")
    }
  }
}

export { MailService }
