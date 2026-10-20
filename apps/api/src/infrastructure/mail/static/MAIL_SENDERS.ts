import type { TMailSender } from "../types/TMailSender"
import { DICTIONARY } from "@shared/static/DICTIONARY"

const MAIL_SENDERS = {
  "no-reply": DICTIONARY.mail.senders["no-reply"],
  support: DICTIONARY.mail.senders.support,
  security: DICTIONARY.mail.senders.security,
} satisfies Record<TMailSender, string>

export { MAIL_SENDERS }
