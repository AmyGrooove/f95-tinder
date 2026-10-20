import type { IConfirmation } from "@endpoints/auth"

interface IAccountSetup extends IConfirmation {
  email: string
  passwordHash: string
  accessCodeHash: string
}

export type { IAccountSetup }
