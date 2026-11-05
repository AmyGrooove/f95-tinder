import type { SearchBodyDto } from "../dto/search.body"

interface IFindSearchItemsProps {
  body: SearchBodyDto
  searchFilters: string[]
}

export type { IFindSearchItemsProps }
