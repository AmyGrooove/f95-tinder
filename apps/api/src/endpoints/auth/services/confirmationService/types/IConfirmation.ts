interface IConfirmation {
  userId: string
  codeHash: string
  attemptsRemaining: number
}

export type { IConfirmation }
