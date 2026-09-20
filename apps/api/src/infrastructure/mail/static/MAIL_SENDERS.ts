import type { TMailSender } from "../types/TMailSender"

const MAIL_SENDERS = {
  "no-reply": "No Reply",
  support: "Support",
  security: "Security",
} satisfies Record<TMailSender, string>

export { MAIL_SENDERS }
