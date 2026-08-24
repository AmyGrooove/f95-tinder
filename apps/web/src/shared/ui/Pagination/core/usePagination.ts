import { useMemo } from 'react'
import { getPaginationItems } from '../functions/getPaginationItems'
import type { IPaginationProps } from '../types/IPaginationProps'

const usePagination = (props: IPaginationProps) => {
  const { className, onPageChange, page, totalPages } = props

  const isHidden = totalPages < 1
  const normalizedPage = Math.min(Math.max(page, 1), totalPages)

  const paginationItems = useMemo(() => {
    return getPaginationItems({
      page: normalizedPage,
      totalPages,
    })
  }, [normalizedPage, totalPages])

  const isPreviousButtonDisabled = normalizedPage === 1
  const isNextButtonDisabled = normalizedPage === totalPages

  const handlePageChange = (nextPage: number) => {
    if (nextPage === normalizedPage) {
      return
    }

    onPageChange(nextPage)
  }

  const handlePreviousPageClick = () => {
    handlePageChange(normalizedPage - 1)
  }

  const handleNextPageClick = () => {
    handlePageChange(normalizedPage + 1)
  }

  return {
    className,
    handleNextPageClick,
    handlePageChange,
    handlePreviousPageClick,
    isHidden,
    isNextButtonDisabled,
    isPreviousButtonDisabled,
    normalizedPage,
    paginationItems,
  }
}

export { usePagination }
