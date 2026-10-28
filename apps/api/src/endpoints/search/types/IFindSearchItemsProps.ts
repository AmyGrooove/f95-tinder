import type { SearchBodyDto } from "../dto/body/search.body"

interface IFindSearchItemsProps {
  body: SearchBodyDto
  searchFilters: string[]
}

export type { IFindSearchItemsProps }
