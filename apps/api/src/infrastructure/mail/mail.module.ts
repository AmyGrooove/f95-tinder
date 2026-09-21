import { Module } from "@nestjs/common"
import { createTransport } from "nodemailer"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { JobsModule } from "@infrastructure/jobs/jobs.module"

import { SendMailJobHandler } from "./handlers/sendMailJob.handler"
import { MailHealthService } from "./services/mailHealth.service"
import { MailService } from "./services/mail.service"
import { MAIL_CLIENT } from "./static/MAIL_CLIENT"

@Module({
  imports: [InfrastructureConfigModule, JobsModule],
  providers: [
    {
      provide: MAIL_CLIENT,
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        const { host, password, port, secure, user } = configurationService.mail

        return createTransport({
          auth: { pass: password, user },
          host,
          port,
          secure,
        })
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
