import { cn } from '@shared/functions/utility/cn'
import { Button } from '@shared/ui/Button'
import { Icon } from '@shared/ui/Icon'
import { usePagination } from './usePagination'
import st from './Pagination.module.scss'
import type { IPaginationProps } from '../types/IPaginationProps'
import { isNil } from '@shared/functions/checks/isNil'

const Pagination = (props: IPaginationProps) => {
  const {
    className,
    handleNextPageClick,
    handlePageChange,
    handlePreviousPageClick,
    isHidden,
    isNextButtonDisabled,
    isPreviousButtonDisabled,
    normalizedPage,
    paginationItems,
  } = usePagination(props)

  if (isHidden) {
    return null
  }

  return (
    <nav className={cn(st.root, className)}>
      <ul className={st.content}>
        <li className={st.item}>
          <Button
            isDisabled={isPreviousButtonDisabled}
            onClick={handlePreviousPageClick}
            size="large"
            variant="secondary"
          >
            <Icon name="chevronLeft" />
          </Button>
        </li>
        {paginationItems.map((paginationItem, index) => {
          if (isNil(paginationItem)) {
            return (
              <li className={st.ellipsis} key={`ellipsis-${index}`}>
                <Icon name="ellipsis" />
              </li>
            )
          }

          const isCurrentPage = paginationItem === normalizedPage

          return (
            <li className={st.item} key={paginationItem}>
              <Button
                className={st.pageButton}
                onClick={() => {
                  handlePageChange(paginationItem)
                }}
                size="large"
                variant={isCurrentPage ? 'primary' : 'ghost'}
              >
                {paginationItem}
              </Button>
            </li>
          )
        })}
        <li className={st.item}>
          <Button
            isDisabled={isNextButtonDisabled}
            onClick={handleNextPageClick}
            size="large"
            variant="secondary"
          >
            <Icon name="chevronRight" />
          </Button>
        </li>
      </ul>
    </nav>
  )
}

export { Pagination }
