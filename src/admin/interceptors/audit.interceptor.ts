import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggerService } from 'src/logger/logger.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';
import type { JwtPayload } from 'src/auth/interfaces';
import type { Request } from 'express';

interface AdminRequest extends Request {
  user: JwtPayload;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest<AdminRequest>();
    const { user, params } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          const sanitized = this.sanitizeParams(params);
          this.prisma.auditLog
            .create({
              data: {
                actorId: user.sub,
                action,
                targetType: this.deriveTargetType(params),
                targetId: sanitized.userId ?? sanitized.taskId ?? sanitized.id ?? null,
                metadata: { params: sanitized },
              },
            })
            .catch((err: unknown) =>
              this.logger.error(
                'Audit log write failed',
                err instanceof Error ? err : undefined,
                AuditInterceptor.name,
              ),
            );
        },
      }),
    );
  }

  private deriveTargetType(params: Record<string, string | string[]>): string {
    if ('userId' in params) return 'User';
    if ('taskId' in params) return 'Task';
    if ('jobId' in params) return 'QueueJob';
    if ('orgId' in params) return 'Organization';
    return 'Unknown';
  }

  private sanitizeParams(params: Record<string, string | string[]>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(params)
        .filter(([key]) => !key.toLowerCase().includes('secret'))
        .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
    );
  }
}
