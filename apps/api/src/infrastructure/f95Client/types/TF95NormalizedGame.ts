type TF95NormalizedGame = {
  f95ThreadId: number
  threadUrl: string
  title: string
  creator: string
  version: string
  coverUrl: string | null
  screenshotUrls: string[]
  f95UpdatedAt: Date | null
  f95TagIds: number[]
  f95PrefixIds: number[]
}

export type { TF95NormalizedGame }
