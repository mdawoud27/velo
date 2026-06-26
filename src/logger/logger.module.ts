import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { LoggerService } from './logger.service';

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
            redact: [
              'req.headers.authorization',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.confirmPassword',
              'req.body.refreshToken',
            ],
          },
        };
      },
    }),
  ],
  providers: [LoggerService],
  exports: [PinoLoggerModule, LoggerService],
})
export class LoggerModule {}
