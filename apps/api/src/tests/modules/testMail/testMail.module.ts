import { Module } from "@nestjs/common"

import { MailService } from "@infrastructure/mail/services/mail.service"

import { TestMailService } from "./testMail.service"

@Module({
  providers: [
    TestMailService,
    { provide: MailService, useExisting: TestMailService },
  ],
  exports: [MailService, TestMailService],
})
class TestMailModule {}

export { TestMailModule }
