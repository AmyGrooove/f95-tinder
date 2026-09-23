import { Injectable } from "@nestjs/common"
import { MailerService } from "@nestjs-modules/mailer"

@Injectable()
class MailHealthService {
  constructor(private readonly mailerService: MailerService) {}

  async healthCheck() {
    try {
      return await this.mailerService.verifyAllTransporters()
    } catch {
      return false
    }
  }
}

export { MailHealthService }
