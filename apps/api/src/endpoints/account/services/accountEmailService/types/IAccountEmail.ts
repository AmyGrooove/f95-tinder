import type { IConfirmation } from "@endpoints/auth/services/confirmationService"

interface IAccountEmail extends IConfirmation {
  email: string
  currentEmail: string
  passwordHash: string
}

export type { IAccountEmail }
