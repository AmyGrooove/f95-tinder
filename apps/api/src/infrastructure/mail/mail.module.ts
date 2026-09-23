import { Module } from "@nestjs/common"
import { MailerModule } from "@nestjs-modules/mailer"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { JobsModule } from "@infrastructure/jobs/jobs.module"

import { SendMailJobHandler } from "./handlers/sendMailJob.handler"
import { MailHealthService } from "./services/mailHealth.service"
import { MailService } from "./services/mail.service"
@Module({
  imports: [
    InfrastructureConfigModule,
    JobsModule,
    MailerModule.forRootAsync({
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        const { host, password, port, secure, user } = configurationService.mail

        return {
          transport: {
            auth: { pass: password, user },
            host,
            port,
            requireTLS: true,
            secure,
          },
        }
      },
    }),
  ],
  providers: [SendMailJobHandler, MailHealthService, MailService],
  exports: [MailHealthService, MailService],
})
class MailModule {}

export { MailModule }
