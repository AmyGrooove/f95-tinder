import { Module } from "@nestjs/common"
import { Resend } from "resend"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { JobsModule } from "@infrastructure/jobs/jobs.module"

import { SendMailJobHandler } from "@infrastructure/mail/services/sendMailJobHandler"
import { MailHealthService } from "@infrastructure/mail/services/mailHealthService"
import { MailService } from "@infrastructure/mail/services/mailService"
import { MAIL_CLIENT } from "./static/MAIL_CLIENT"

@Module({
  imports: [InfrastructureConfigModule, JobsModule],
  providers: [
    {
      provide: MAIL_CLIENT,
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        return new Resend(configurationService.mail.apiKey)
      },
    },
    SendMailJobHandler,
    MailHealthService,
    MailService,
  ],
  exports: [MailHealthService, MailService],
})
class MailModule {}

export { MailModule }
