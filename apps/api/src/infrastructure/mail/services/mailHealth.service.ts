import { Inject, Injectable } from "@nestjs/common"
import type { Resend } from "resend"

import { isNil } from "@shared/functions/checks/isNil"

import { MAIL_CLIENT } from "../static/MAIL_CLIENT"

@Injectable()
class MailHealthService {
  constructor(@Inject(MAIL_CLIENT) private readonly mailClient: Resend) {}

  async healthCheck() {
    try {
      const result = await this.mailClient.domains.list()

      return isNil(result.error)
    } catch {
      return false
    }
  }
}

export { MailHealthService }
