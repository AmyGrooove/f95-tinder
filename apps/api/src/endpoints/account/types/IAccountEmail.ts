import type { IConfirmation } from "@endpoints/auth"

interface IAccountEmail extends IConfirmation {
  email: string
  currentEmail: string
  passwordHash: string
}

export type { IAccountEmail }
