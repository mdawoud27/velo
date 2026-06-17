import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LoggerService } from '../logger/logger.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService, logger: LoggerService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (!redisUrl) {
          logger.error('REDIS_URL is not defined', undefined, 'RedisModule');
          process.exit(1);
        }

        const client: Redis = new Redis(redisUrl, {
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
        });

        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err: Error) =>
          logger.error('Redis connection error', err, 'RedisModule'),
        );

        return client;
      },
      inject: [ConfigService, LoggerService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
