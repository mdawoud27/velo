import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import {
  SuccessResponseOf,
  PaginatedResponseOf,
  MessageResponseDto,
  ApiErrorResponseDto,
  ApiValidationErrorResponseDto,
  ApiUnauthorizedErrorResponseDto,
  ApiForbiddenErrorResponseDto,
  ApiNotFoundErrorResponseDto,
  ApiConflictErrorResponseDto,
  ApiUnprocessableEntityErrorResponseDto,
  ApiTooManyRequestsErrorResponseDto,
} from '../dtos/api-response.dto';

/** GET / PATCH / DELETE that returns a data object */
export const ApiDataResponse = <T>(DataDto: Type<T>, description?: string) =>
  ApiResponse({ status: 200, description, type: SuccessResponseOf(DataDto) });

/** GET list with pagination meta */
export const ApiPaginatedDataResponse = <T>(DataDto: Type<T>, description?: string) =>
  ApiResponse({ status: 200, description, type: PaginatedResponseOf(DataDto) });

/** Endpoints that return only a message (data: null) */
export const ApiMessageResponse = (description?: string, status = 200) =>
  ApiResponse({ status, description, type: MessageResponseDto });

/** Drop-in bundle for common error status codes */
export const ApiErrorResponses = (...statuses: (400 | 401 | 402 | 403 | 404 | 409 | 422 | 429)[]) =>
  applyDecorators(
    ...statuses.map((status) => {
      switch (status) {
        case 400:
          return ApiResponse({ status: 400, type: ApiValidationErrorResponseDto });
        case 401:
          return ApiResponse({ status: 401, type: ApiUnauthorizedErrorResponseDto });
        case 403:
          return ApiResponse({ status: 403, type: ApiForbiddenErrorResponseDto });
        case 404:
          return ApiResponse({ status: 404, type: ApiNotFoundErrorResponseDto });
        case 409:
          return ApiResponse({ status: 409, type: ApiConflictErrorResponseDto });
        case 422:
          return ApiResponse({ status: 422, type: ApiUnprocessableEntityErrorResponseDto });
        case 429:
          return ApiResponse({ status: 429, type: ApiTooManyRequestsErrorResponseDto });
        default:
          return ApiResponse({ status, type: ApiErrorResponseDto });
      }
    }),
  );

export const ApiRedirectResponse = (description: string) =>
  ApiResponse({ status: 302, description });
