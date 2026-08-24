import { isNil } from '@shared/functions/checks/isNil'
import type { IGetPaginationItemsProps } from '../types/IGetPaginationItemsProps'

const getPaginationItems = (props: IGetPaginationItemsProps) => {
  const { page, totalPages } = props

  if (totalPages < 1) {
    return []
  }

  const startPage = Math.max(1, page - 2)
  const endPage = Math.min(totalPages, page + 2)
  const visiblePagesCount = endPage - startPage + 1
  const visiblePageNumbers = Array.from(
    { length: visiblePagesCount },
    (_, pageIndex) => {
      return startPage + pageIndex
    },
  )
  const pageNumbers = Array.from(
    new Set([1, ...visiblePageNumbers, totalPages]),
  )

  return pageNumbers.flatMap((pageNumber, pageIndex) => {
    const previousPageNumber = pageNumbers[pageIndex - 1]

    if (!isNil(previousPageNumber) && pageNumber - previousPageNumber > 1) {
      return [null, pageNumber]
    }

    return [pageNumber]
  })
}

export { getPaginationItems }
