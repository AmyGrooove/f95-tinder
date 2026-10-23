import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

import type { INormalizePaginationProps } from "../types/INormalizePaginationProps"

const normalizePagination = (
  pagination: INormalizePaginationProps | undefined,
  defaultLimit: number,
) => {
  const requestedPage = pagination?.page
  const requestedLimit = pagination?.limit

  return {
    page: isFiniteNumber(requestedPage)
      ? Math.max(1, Math.floor(requestedPage))
      : 1,
    limit: isFiniteNumber(requestedLimit)
      ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
      : defaultLimit,
  }
}

export { normalizePagination }
