interface IPaginationProps {
  onPageChange: (page: number) => void
  page: number
  totalPages: number

  className?: string
}

export type { IPaginationProps }
