import type { IConfirmation } from "./IConfirmation"

interface IPasswordReset extends IConfirmation {
  email: string
  passwordHash: string
}

export type { IPasswordReset }
