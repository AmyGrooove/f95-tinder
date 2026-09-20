import { Inject, Injectable } from "@nestjs/common"
import type { Resend } from "resend"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

import { MAIL_CLIENT } from "../static/MAIL_CLIENT"
import { MAIL_JOB_NAME } from "../static/MAIL_JOB_NAME"
import { MAIL_SENDERS } from "../static/MAIL_SENDERS"
import type { ISendMailOptions } from "../types/ISendMailOptions"

@Injectable()
@JobHandler(MAIL_JOB_NAME, {
  attempts: 4,
  retryDelays: [1_000, 5_000, 30_000],
  concurrency: 5,
})
class SendMailJobHandler {
  constructor(
    @Inject(MAIL_CLIENT) private readonly mailClient: Resend,
    private readonly infrastructureConfigService: InfrastructureConfigService,
  ) {}

  async handle(id: string, payload: ISendMailOptions) {
    const content =
      isString(payload.html) && payload.html !== ""
        ? { html: payload.html, text: payload.text }
        : isString(payload.text) && payload.text !== ""
          ? { text: payload.text }
          : undefined

    if (isNil(content)) {
      throw new Error("Mail content must include text or HTML")
    }

    const sender = payload.from ?? "no-reply"
    const domain = this.infrastructureConfigService.mail.domain
    const result = await this.mailClient.emails.send(
      {
        ...content,
        attachments: payload.attachments,
        from: `${MAIL_SENDERS[sender]} <${sender}@${domain}>`,
        replyTo: payload.replyTo,
        subject: payload.subject,
        to: payload.to,
      },
      { idempotencyKey: payload.idempotencyKey ?? `${MAIL_JOB_NAME}:${id}` },
    )

    if (!isNil(result.error)) {
      throw new Error("Mail provider rejected the message", {
        cause: result.error,
      })
    }

    const deliveryId = result.data?.id

    if (isNil(deliveryId) || deliveryId === "") {
      throw new Error("Mail provider did not return a delivery identifier")
    }

    return { id: deliveryId, status: "sent" }
  }
}

export { SendMailJobHandler }
