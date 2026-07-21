import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import {
  ClassSerializerInterceptor,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import session from 'express-session';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/middlewares';
import { RedisService } from './redis/redis.service';
import { RedisSessionStore } from './common/session/redis-session.store';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });

  // app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));
  // app.use(express.json());

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET must be set');
  }

  const redisService = app.get(RedisService);
  const store = new RedisSessionStore(redisService);

  app.use(requestIdMiddleware);
  app.use(
    session({
      name: 'app.sid',
      store,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      },
    }),
  );

  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.enableCors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['', 'health'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const flatten = (
          errs: typeof errors,
          parentField = '',
        ): { field: string; message: string }[] =>
          errs.flatMap((error) => {
            const field = parentField ? `${parentField}.${error.property}` : error.property;

            const messages = Object.values(error.constraints ?? {}).map((message) => ({
              field,
              message,
            }));

            const nested = error.children?.length ? flatten(error.children, field) : [];

            return [...messages, ...nested];
          });

        throw new UnprocessableEntityException({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: flatten(errors),
          },
        });
      },
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Velo API')
    .setDescription('Production-grade project management API')
    .addServer('http://localhost:3000', 'Development')
    .addServer('https://velo-app.up.railway.app', 'Production')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
    })
    .addTag('Health', 'Health check')
    .addTag('Home', 'API root and health check')
    .addTag('Auth', 'Authentication and account management')
    .addTag('Users', 'User profile management')
    .addTag('Organizations', 'Organization management')
    .addTag('Teams', 'Team management')
    .addTag('Projects', 'Project management')
    .addTag('Tasks', 'Task management')
    .addTag('Comments', 'Comment management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true, filter: true },
    jsonDocumentUrl: 'api-docs/json',
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
