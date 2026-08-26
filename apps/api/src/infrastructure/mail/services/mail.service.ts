import { Inject, Injectable } from "@nestjs/common"
import type { Resend } from "resend"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { JobService } from "@infrastructure/jobs/services/job.service"

import { MAIL_CLIENT } from "../static/MAIL_CLIENT"
import { MAIL_DEFAULT_SENDER } from "../static/MAIL_DEFAULT_SENDER"
import { MAIL_DELIVERY_MODE } from "../static/MAIL_DELIVERY_MODE"
import { MAIL_JOB_NAME } from "../static/MAIL_JOB_NAME"
import type { IMailDeliveryResult } from "../types/IMailDeliveryResult"
import type { ISendMailOptions } from "../types/ISendMailOptions"

@Injectable()
class MailService {
  constructor(
    @Inject(MAIL_CLIENT) private readonly mailClient: Resend,
    private readonly infrastructureConfigService: InfrastructureConfigService,
    private readonly jobService: JobService,
  ) {}

  async send(options: ISendMailOptions): Promise<IMailDeliveryResult> {
    this.validateOptions(options)

    if (MAIL_DELIVERY_MODE === "queue") {
      const id = await this.jobService.add(MAIL_JOB_NAME, options)

      return {
        id,
        status: "queued",
      }
    }

    return this.deliverDirect(options)
  }

  async deliverDirect(options: ISendMailOptions): Promise<IMailDeliveryResult> {
    this.validateOptions(options)

    try {
      const result = await this.mailClient.emails.send({
        attachments: options.attachments,
        from: this.buildSenderAddress(options.from),
        replyTo: options.replyTo,
        subject: options.subject,
        to: options.to,
        ...(options.html ? { html: options.html } : { text: options.text! }),
      })

      if (result.error) {
        throw new Error("Mail provider rejected the message", {
          cause: result.error,
        })
      }

      if (!result.data?.id) {
        throw new Error("Mail provider did not return a delivery identifier")
      }

      return {
        id: result.data.id,
        status: "sent",
      }
    } catch (error) {
      throw new Error("Mail provider failed to send the message", {
        cause: error,
      })
    }
  }

  private buildSenderAddress(alias?: string): string {
    const senderAlias = alias ?? MAIL_DEFAULT_SENDER
    const domain = this.infrastructureConfigService.mail.domain

    if (!senderAlias || !domain || !this.isValidAlias(senderAlias)) {
      throw new Error("Mail sender alias must be a valid local part")
    }

    return `${senderAlias}@${domain}`
  }

  private isValidAlias(value: string): boolean {
    return /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(
      value,
    )
  }

  private validateOptions(options: ISendMailOptions): void {
    if (!options.subject.trim()) {
      throw new Error("Mail subject must not be empty")
    }

    if (!options.text && !options.html) {
      throw new Error("Mail content must include text or HTML")
    }
  }
}

export { MailService }
