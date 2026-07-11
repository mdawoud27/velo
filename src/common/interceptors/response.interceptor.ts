import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ApiPaginatedResponse, ApiSuccessResponse, PaginationMeta } from '../interfaces';
import { Reflector } from '@nestjs/core';
import { RESPONSE_MESSAGE_KEY } from '../decorators';
import { ServiceMessage } from '../classes';

type PaginatedPayload<T> = { data: T[]; meta: PaginationMeta };

function isPaginatedPayload(value: unknown): value is PaginatedPayload<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'data' in value &&
    'meta' in value &&
    Array.isArray((value as Record<string, unknown>).data)
  );
}

function isServiceMessage(value: unknown): value is ServiceMessage {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).__type === 'ServiceMessage' &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T> | ApiPaginatedResponse<unknown>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | ApiPaginatedResponse<unknown>> {
    const message = this.reflector.getAllAndOverride<string | undefined>(RESPONSE_MESSAGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((response: T): ApiSuccessResponse<T> | ApiPaginatedResponse<unknown> => {
        const timestamp = new Date().toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'long',
        });

        if (isServiceMessage(response)) {
          return {
            success: true,
            data: null,
            message: response.message,
            timestamp,
          };
        }

        if (isPaginatedPayload(response)) {
          return {
            success: true,
            ...(message && { message }),
            data: response.data,
            meta: response.meta,
            timestamp,
          };
        }

        return {
          success: true,
          ...(message && { message }),
          data: response ?? null,
          timestamp,
        };
      }),
    );
  }
}
