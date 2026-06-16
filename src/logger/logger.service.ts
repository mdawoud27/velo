import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(private readonly logger: PinoLogger) {}

  log(message: string, context?: object) {
    this.logger.info(context ?? {}, message);
  }

  error(message: string, error?: Error, context?: object) {
    this.logger.error(
      {
        err: error,
        ...context,
      },
      message,
    );
  }

  warn(message: string, context?: object) {
    this.logger.warn(context ?? {}, message);
  }

  debug(message: string, context?: object) {
    this.logger.debug(context ?? {}, message);
  }

  verbose(message: string, context?: object) {
    this.logger.trace(context ?? {}, message);
  }
}
