import { randomUUID } from "node:crypto"

import type { MailService } from "@infrastructure/mail/services/mail.service"
import type { IMailDeliveryResult } from "@infrastructure/mail/types/IMailDeliveryResult"
import type { ISendMailOptions } from "@infrastructure/mail/types/ISendMailOptions"

class TestMailService implements Pick<MailService, "send"> {
  readonly messages: ISendMailOptions[] = []

  async send(options: ISendMailOptions) {
    this.messages.push(structuredClone(options))

    return { id: randomUUID(), status: "queued" } satisfies IMailDeliveryResult
  }

  clear() {
    this.messages.length = 0
  }
}

export { TestMailService }
