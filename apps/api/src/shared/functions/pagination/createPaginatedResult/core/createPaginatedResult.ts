const createPaginatedResult = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
) => {
  const pages = Math.ceil(total / limit)

  return {
    items,
    page,
    limit,
    total,
    pages,
    isNextPage: page < pages,
    isPreviousPage: page > 1,
  }
}

export { createPaginatedResult }
