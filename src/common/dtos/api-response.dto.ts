import { ApiProperty } from '@nestjs/swagger';
import type { Type } from '@nestjs/common';

export class ApiResponseBaseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ required: false, example: 'Operation successful' })
  message?: string;

  @ApiProperty({ example: 'Monday, June 29, 2026 at 10:00:00 AM EDT' })
  timestamp: string;
}

// Paginated meta

export class PaginationMetaDto {
  @ApiProperty({ example: 100 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 10 }) limit: number;
  @ApiProperty({ example: 10 }) totalPages: number;
  @ApiProperty({ example: true }) hasNextPage: boolean;
  @ApiProperty({ example: false }) hasPreviousPage: boolean;
}

// Generic success wrapper factory

export function SuccessResponseOf<T>(DataDto: Type<T>) {
  class SuccessResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: () => DataDto, nullable: true })
    data: T | null;
  }

  // Unique name per type → unique schema in Swagger spec
  Object.defineProperty(SuccessResponseDto, 'name', {
    value: `SuccessResponseOf${DataDto.name}`,
  });

  return SuccessResponseDto;
}

// Generic paginated wrapper factory

export function PaginatedResponseOf<T>(DataDto: Type<T>) {
  class PaginatedResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: () => DataDto, isArray: true })
    data: T[];

    @ApiProperty({ type: () => PaginationMetaDto })
    meta: PaginationMetaDto;
  }

  Object.defineProperty(PaginatedResponseDto, 'name', {
    value: `PaginatedResponseOf${DataDto.name}`,
  });

  return PaginatedResponseDto;
}

// Message-only (ServiceMessage case, data is always null)

export class MessageResponseDto extends ApiResponseBaseDto {
  @ApiProperty({ example: 'Operation successful' })
  declare message: string;
  @ApiProperty({ type: Object, nullable: true, example: null })
  data: null;
}

// Error responses

class ErrorBodyDto {
  @ApiProperty({ example: 'NOT_FOUND' }) code: string;
  @ApiProperty({ example: 'User not found' }) message: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false }) success: false;
  @ApiProperty({ type: () => ErrorBodyDto }) error: ErrorBodyDto;
  @ApiProperty() timestamp: string;
}

class UnauthorizedErrorBodyDto {
  @ApiProperty({ example: 'UNAUTHORIZED' }) code: string;
  @ApiProperty({ example: 'Unauthorized access' }) message: string;
}

export class ApiUnauthorizedErrorResponseDto {
  @ApiProperty({ example: false }) success: false;
  @ApiProperty({ type: () => UnauthorizedErrorBodyDto }) error: UnauthorizedErrorBodyDto;
  @ApiProperty() timestamp: string;
}

class ForbiddenErrorBodyDto {
  @ApiProperty({ example: 'FORBIDDEN' }) code: string;
  @ApiProperty({ example: 'You do not have permission to access this resource' }) message: string;
}

export class ApiForbiddenErrorResponseDto {
  @ApiProperty({ example: false }) success: false;
  @ApiProperty({ type: () => ForbiddenErrorBodyDto }) error: ForbiddenErrorBodyDto;
  @ApiProperty() timestamp: string;
}

class NotFoundErrorBodyDto {
  @ApiProperty({ example: 'RESOURCE_NOT_FOUND' }) code: string;
  @ApiProperty({ example: 'Resource not found' }) message: string;
}

export class ApiNotFoundErrorResponseDto {
  @ApiProperty({ example: false }) success: false;
  @ApiProperty({ type: () => NotFoundErrorBodyDto }) error: NotFoundErrorBodyDto;
  @ApiProperty() timestamp: string;
}

class ConflictErrorBodyDto {
  @ApiProperty({ example: 'CONFLICT' }) code: string;
  @ApiProperty({ example: 'Resource state conflict' }) message: string;
}

export class ApiConflictErrorResponseDto {
  @ApiProperty({ example: false }) success: false;
  @ApiProperty({ type: () => ConflictErrorBodyDto }) error: ConflictErrorBodyDto;
  @ApiProperty() timestamp: string;
}

class UnprocessableEntityErrorBodyDto {
  @ApiProperty({ example: 'UNPROCESSABLE_ENTITY' }) code: string;
  @ApiProperty({ example: 'Validation failed or entity cannot be processed' }) message: string;
}

export class ApiUnprocessableEntityErrorResponseDto {
  @ApiProperty({ example: false }) success: false;
  @ApiProperty({ type: () => UnprocessableEntityErrorBodyDto })
  error: UnprocessableEntityErrorBodyDto;
  @ApiProperty() timestamp: string;
}

class TooManyRequestsErrorBodyDto {
  @ApiProperty({ example: 'TOO_MANY_REQUESTS' }) code: string;
  @ApiProperty({ example: 'Rate limit exceeded. Please try again later.' }) message: string;
}

export class ApiTooManyRequestsErrorResponseDto {
  @ApiProperty({ example: false }) success: false;
  @ApiProperty({ type: () => TooManyRequestsErrorBodyDto }) error: TooManyRequestsErrorBodyDto;
  @ApiProperty() timestamp: string;
}

class ValidationFieldDto {
  @ApiProperty({ example: 'email' }) field: string;
  @ApiProperty({ example: 'must be an email', required: false }) message?: string;
}

class ValidationErrorBodyDto extends ErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' }) declare code: 'VALIDATION_ERROR';
  @ApiProperty({ type: () => ValidationFieldDto, isArray: true }) errors: ValidationFieldDto[];
}

export class ApiValidationErrorResponseDto {
  @ApiProperty({ example: false }) success: false;
  @ApiProperty({ type: () => ValidationErrorBodyDto }) error: ValidationErrorBodyDto;
  @ApiProperty() timestamp: string;
}
