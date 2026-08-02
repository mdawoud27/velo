import { PaginationMeta } from '../interfaces';

export type PaginatedPayload<T> = { data: T[]; meta: PaginationMeta };
