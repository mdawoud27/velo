import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { LoggerService } from './logger.service';
import { randomUUID } from 'crypto';
import { requestContext } from 'src/common/middlewares';
import { Request } from 'express';

function isPinoPrettyAvailable(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV');
        const isProduction = nodeEnv === 'production';
        const isDevelopment = nodeEnv === 'development';
        const usePrettyTransport = isDevelopment && isPinoPrettyAvailable();

        if (isDevelopment && !isPinoPrettyAvailable()) {
          console.warn(
            '[LoggerModule] NODE_ENV=development but pino-pretty is not installed; falling back to JSON logs.',
          );
        }

        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: usePrettyTransport
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                  },
                }
              : undefined,
            genReqId: (req) => {
              const headerRequestId = Array.isArray(req.headers['x-request-id'])
                ? req.headers['x-request-id'][0]
                : req.headers['x-request-id'];
              const requestId =
                headerRequestId ?? requestContext.getStore()?.requestId ?? randomUUID();
              req.headers['x-request-id'] = requestId;
              return requestId;
            },
            customProps: (req) => ({
              requestId:
                requestContext.getStore()?.requestId ??
                (Array.isArray(req.headers['x-request-id'])
                  ? req.headers['x-request-id'][0]
                  : req.headers['x-request-id']),
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
                const [path] = req.url.split('?');
                return { method: req.method, url: path };
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
