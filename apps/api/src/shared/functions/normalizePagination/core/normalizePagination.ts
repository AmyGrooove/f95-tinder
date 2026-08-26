import { isNil } from "@shared/functions/isNil"

const normalizePagination = (
  pagination: { page?: number; limit?: number } | undefined,
  defaultLimit: number,
) => {
  const requestedPage = pagination?.page
  const requestedLimit = pagination?.limit

  return {
    page: isNil(requestedPage) || !Number.isFinite(requestedPage)
      ? 1
      : Math.max(1, Math.floor(requestedPage)),
    limit: isNil(requestedLimit) || !Number.isFinite(requestedLimit)
      ? defaultLimit
      : Math.min(100, Math.max(1, Math.floor(requestedLimit))),
  }
}

export { normalizePagination }
