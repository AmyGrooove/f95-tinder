import type { IConfirmation } from "@endpoints/auth/services/confirmationService"

interface IPasswordReset extends IConfirmation {
  email: string
  passwordHash: string
}

export type { IPasswordReset }
