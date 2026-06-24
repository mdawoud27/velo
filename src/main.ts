import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import { requestIdMiddleware } from './common/middlewares';
import { RedisService } from './redis/redis.service';
import { RedisSessionStore } from './common/session/redis-session.store';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const redisService = app.get(RedisService);
  const store = new RedisSessionStore(redisService);

  app.use(requestIdMiddleware);
  app.use(
    session({
      store,
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      },
    }),
  );

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
