import { Module } from "@nestjs/common"
import { Resend } from "resend"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { JobsModule } from "@infrastructure/jobs/jobs.module"

import { MailProcessor } from "./processors/mail.processor"
import { MailService } from "./services/mail.service"
import { MAIL_CLIENT } from "./static/MAIL_CLIENT"

@Module({
  imports: [InfrastructureConfigModule, JobsModule],
  providers: [
    {
      provide: MAIL_CLIENT,
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        const mail = configurationService.mail
        const apiKey = mail.apiKey?.trim()
        const domain = mail.domain?.trim()

        if (!apiKey || !domain) {
          throw new Error(
            "RESEND_ACCESS_SECRET and MAIL_DOMAIN must be configured",
          )
        }

        const isValidDomain =
          /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(
            domain,
          )

        if (!isValidDomain) {
          throw new Error("MAIL_DOMAIN must be a valid email domain")
        }

        return new Resend(apiKey)
      },
    },
    MailProcessor,
    MailService,
  ],
  exports: [MAIL_CLIENT, MailService],
})
class MailModule {}

export { MailModule }
