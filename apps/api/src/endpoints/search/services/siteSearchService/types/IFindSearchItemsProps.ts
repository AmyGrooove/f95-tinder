import type { SearchBodyDto } from "@endpoints/search/dto/body/search.body"

interface IFindSearchItemsProps {
  body: SearchBodyDto
  searchFilters: string[]
}

export type { IFindSearchItemsProps }
