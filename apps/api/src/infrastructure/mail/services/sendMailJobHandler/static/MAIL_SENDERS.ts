import type { TMailSender } from "@infrastructure/mail/services/mailService"
import { DICTIONARY } from "@shared/static/DICTIONARY"

const MAIL_SENDERS = {
  "no-reply": DICTIONARY.mail.senders["no-reply"],
  support: DICTIONARY.mail.senders.support,
  security: DICTIONARY.mail.senders.security,
} satisfies Record<TMailSender, string>

export { MAIL_SENDERS }
