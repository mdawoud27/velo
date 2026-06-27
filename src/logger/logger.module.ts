import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { LoggerService } from './logger.service';
import { randomUUID } from 'crypto';
import { requestContext } from 'src/common/middlewares';
import { Request } from 'express';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV');
        const isProduction = nodeEnv === 'production';
        const isDevelopment = nodeEnv === 'development';

        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isDevelopment
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                  },
                }
              : undefined,
            genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
            customProps: () => ({
              requestId: requestContext?.getStore()?.requestId,
            }),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.body.password',
                'req.body.currentPassword',
                'req.body.newPassword',
                'req.body.token',
                'req.body.refreshToken',
              ],
              censor: '[REDACTED]',
            },
            serializers: {
              req(req: Request) {
                return { method: req.method, url: req.url };
              },
            },
          },
        };
      },
    }),
  ],
  providers: [LoggerService],
  exports: [PinoLoggerModule, LoggerService],
})
export class LoggerModule {}
