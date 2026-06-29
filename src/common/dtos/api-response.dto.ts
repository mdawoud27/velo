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
