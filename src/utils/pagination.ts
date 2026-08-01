export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export const parsePagination = (query: PaginationQuery): PaginationParams => {
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const buildPaginatedResult = <T>(
  data: T[],
  total: number,
  { page, limit }: PaginationParams,
): PaginatedResult<T> => ({
  data,
  meta: {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  },
});
