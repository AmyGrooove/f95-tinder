import type { IJobListItem } from "./IJobListItem"

interface IJobListResult {
  items: IJobListItem[]
  limit: number
  offset: number
}

export type { IJobListResult }
