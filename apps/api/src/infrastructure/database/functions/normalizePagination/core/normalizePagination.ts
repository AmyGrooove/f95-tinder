import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import type { IPagePagination } from "../../../types/IPaginationInput"

const normalizePagination = (
  pagination: IPagePagination | undefined,
): Required<IPagePagination> => {
  const requestedPage = pagination?.page
  const requestedLimit = pagination?.limit

  return {
    page: isFiniteNumber(requestedPage)
      ? Math.max(1, Math.floor(requestedPage))
      : 1,
    limit:
      requestedLimit === 10 || requestedLimit === 20 || requestedLimit === 50
        ? requestedLimit
        : 50,
  }
}

export { normalizePagination }
