export interface ApiResponseBase {
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse extends ApiResponseBase {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiValidationErrorResponse extends ApiErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    errors: {
      field: string;
      message?: string;
    }[];
  };
}

export interface ApiSuccessResponse<T> extends ApiResponseBase {
  success: true;
  data: T | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiPaginatedResponse<T> extends ApiSuccessResponse<T[]> {
  meta: PaginationMeta;
}
