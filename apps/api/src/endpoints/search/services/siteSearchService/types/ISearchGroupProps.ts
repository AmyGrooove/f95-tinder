import type { SearchBodyDto } from "../dto/search.body"

import type { ESearchGroup } from "./ESearchGroup"
import type { ISearchGroupOptions } from "./ISearchGroupOptions"

interface ISearchGroupProps {
  body: SearchBodyDto
  group: ESearchGroup
  offset: number
  props: ISearchGroupOptions
}

export type { ISearchGroupProps }
