import type { IConfirmation } from "@endpoints/auth/types/IConfirmation"

interface IAccountSetup extends IConfirmation {
  email: string
  passwordHash: string
  accessCodeHash: string
}

export type { IAccountSetup }
