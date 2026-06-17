import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(private readonly logger: PinoLogger) {}

  log(message: string, context?: string | Record<string, unknown>) {
    this.logger.info(this.toBindings(context), message);
  }

  error(message: string, error?: Error, context?: string | Record<string, unknown>) {
    this.logger.error(
      {
        err: error,
        ...this.toBindings(context),
      },
      message,
    );
  }

  warn(message: string, context?: string | Record<string, unknown>) {
    this.logger.warn(this.toBindings(context), message);
  }

  debug(message: string, context?: string | Record<string, unknown>) {
    this.logger.debug(this.toBindings(context), message);
  }

  verbose(message: string, context?: string | Record<string, unknown>) {
    this.logger.trace(this.toBindings(context), message);
  }

  private toBindings(context?: string | Record<string, unknown>) {
    if (!context) return {};
    return typeof context === 'string' ? { context } : context;
  }
}
