import type { IConfirmation } from "@endpoints/auth/services/confirmationService"

interface IAccountSetup extends IConfirmation {
  email: string
  passwordHash: string
  accessCodeHash: string
}

export type { IAccountSetup }
