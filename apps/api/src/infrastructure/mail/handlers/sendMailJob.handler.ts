import { Inject, Injectable } from "@nestjs/common"
import type { Transporter } from "nodemailer"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { JobContext } from "@infrastructure/jobs/types/JobContext"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

import { MAIL_CLIENT } from "../static/MAIL_CLIENT"
import { SEND_MAIL_JOB } from "../static/SEND_MAIL_JOB"
import { MAIL_SENDERS } from "../static/MAIL_SENDERS"
import type { ISendMailJobPayload } from "../types/ISendMailJobPayload"

@Injectable()
@JobHandler(SEND_MAIL_JOB)
class SendMailJobHandler {
  constructor(
    @Inject(MAIL_CLIENT) private readonly mailClient: Transporter,
    private readonly infrastructureConfigService: InfrastructureConfigService,
  ) {}

  async handle(payload: ISendMailJobPayload, context: JobContext) {
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
    const result = await this.mailClient.sendMail({
      ...content,
      attachments: payload.attachments?.map(
        ({ content, isBuffer, ...attachment }) => ({
          ...attachment,
          content: isBuffer ? Buffer.from(content, "base64") : content,
        }),
      ),
      from: `${MAIL_SENDERS[sender]} <${sender}@${domain}>`,
      replyTo: payload.replyTo,
      subject: payload.subject,
      to: payload.to,
    })

    if (isNil(result.messageId) || result.messageId === "") {
      throw new Error("Mail provider did not return a delivery identifier")
    }

    return { id: result.messageId, status: "sent" }
  }
}

export { SendMailJobHandler }
