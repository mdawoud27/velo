import { PaginationMeta } from '../interfaces';

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  if (limit <= 0) {
    throw new RangeError('Pagination limit must be greater than 0');
  }

  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
