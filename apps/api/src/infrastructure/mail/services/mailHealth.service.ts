import { Inject, Injectable } from "@nestjs/common"
import type { Transporter } from "nodemailer"

import { MAIL_CLIENT } from "../static/MAIL_CLIENT"

@Injectable()
class MailHealthService {
  constructor(@Inject(MAIL_CLIENT) private readonly mailClient: Transporter) {}

  async healthCheck() {
    try {
      await this.mailClient.verify()
      return true
    } catch {
      return false
    }
  }
}

export { MailHealthService }
