import { Inject, Injectable } from "@nestjs/common"
import type { Resend } from "resend"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { JobContext } from "@infrastructure/jobs/types/JobContext"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

import { MAIL_CLIENT } from "../static/MAIL_CLIENT"
import { SEND_MAIL_JOB } from "../static/SEND_MAIL_JOB"
import { MAIL_SENDERS } from "../static/MAIL_SENDERS"
import type { ISendMailOptions } from "../types/ISendMailOptions"

@Injectable()
@JobHandler(SEND_MAIL_JOB)
class SendMailJobHandler {
  constructor(
    @Inject(MAIL_CLIENT) private readonly mailClient: Resend,
    private readonly infrastructureConfigService: InfrastructureConfigService,
  ) {}

  async handle(payload: ISendMailOptions, context: JobContext) {
    const content =
      isString(payload.html) && payload.html !== ""
        ? { html: payload.html, text: payload.text }
        : isString(payload.text) && payload.text !== ""
          ? { text: payload.text }
          : undefined

    if (isNil(content)) {
      throw new Error("Mail content must include text or HTML")
    }

    await context.throwIfCancelled()

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
      {
        idempotencyKey:
          payload.idempotencyKey ?? `${SEND_MAIL_JOB.name}:${context.id}`,
      },
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
