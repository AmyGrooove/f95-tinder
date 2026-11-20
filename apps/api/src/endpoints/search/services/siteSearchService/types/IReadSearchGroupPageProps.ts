import type { TPageSize } from "@infrastructure/database/types/TPageSize"

import type { ISearchGroupProps } from "./ISearchGroupProps"

interface IReadSearchGroupPageProps<TCard extends { id: string }> extends Omit<
  ISearchGroupProps,
  "offset"
> {
  offset: number | null | undefined
  isCandidatePage: boolean
  limit: TPageSize
  load: (ids: string[]) => Promise<TCard[]>
}

export type { IReadSearchGroupPageProps }
