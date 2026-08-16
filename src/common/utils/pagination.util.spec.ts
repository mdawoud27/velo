import { buildPaginationMeta } from './pagination.util';

describe('buildPaginationMeta', () => {
  it('returns correct meta for the first page', () => {
    const meta = buildPaginationMeta(100, 1, 10);
    expect(meta).toEqual({
      total: 100,
      page: 1,
      limit: 10,
      totalPages: 10,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('returns correct meta for a middle page', () => {
    const meta = buildPaginationMeta(100, 5, 10);
    expect(meta).toEqual({
      total: 100,
      page: 5,
      limit: 10,
      totalPages: 10,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('returns correct meta for the last page', () => {
    const meta = buildPaginationMeta(100, 10, 10);
    expect(meta).toEqual({
      total: 100,
      page: 10,
      limit: 10,
      totalPages: 10,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('rounds up totalPages when items do not divide evenly', () => {
    const meta = buildPaginationMeta(101, 1, 10);
    expect(meta.totalPages).toBe(11);
    expect(meta.hasNextPage).toBe(true);
  });

  it('returns totalPages of 0 when total is 0', () => {
    const meta = buildPaginationMeta(0, 1, 10);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(false);
  });

  it('hasPreviousPage is false on page 1 even with many pages', () => {
    const meta = buildPaginationMeta(500, 1, 25);
    expect(meta.hasPreviousPage).toBe(false);
    expect(meta.totalPages).toBe(20);
  });

  it('handles large totals correctly', () => {
    const meta = buildPaginationMeta(1_000_000, 1, 100);
    expect(meta.totalPages).toBe(10_000);
    expect(meta.hasNextPage).toBe(true);
  });

  it('throws RangeError when limit is 0', () => {
    expect(() => buildPaginationMeta(100, 1, 0)).toThrow(RangeError);
    expect(() => buildPaginationMeta(100, 1, 0)).toThrow('Pagination limit must be greater than 0');
  });

  it('throws RangeError when limit is negative', () => {
    expect(() => buildPaginationMeta(100, 1, -5)).toThrow(RangeError);
  });
});
