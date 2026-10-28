import type { ISearchDocument } from "./ISearchDocument"

interface ISearchMatch extends ISearchDocument {
  _rankingScore: number
}

export type { ISearchMatch }
