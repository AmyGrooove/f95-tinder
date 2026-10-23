import type { IConfirmation } from "@endpoints/auth/types/IConfirmation"

interface IAccountEmail extends IConfirmation {
  email: string
  currentEmail: string
  passwordHash: string
}

export type { IAccountEmail }
