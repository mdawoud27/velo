import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import {
  SuccessResponseOf,
  PaginatedResponseOf,
  MessageResponseDto,
  ApiErrorResponseDto,
  ApiValidationErrorResponseDto,
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
      if (status === 400) {
        return ApiResponse({ status: 400, type: ApiValidationErrorResponseDto });
      }
      return ApiResponse({ status, type: ApiErrorResponseDto });
    }),
  );

export const ApiRedirectResponse = (description: string) =>
  ApiResponse({ status: 302, description });
