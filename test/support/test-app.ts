import { Test, TestingModule } from '@nestjs/testing';
import {
  ClassSerializerInterceptor,
  INestApplication,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import session from 'express-session';
import { requestIdMiddleware } from 'src/common/middlewares';
import { RedisService } from 'src/redis/redis.service';
import { RedisSessionStore } from 'src/common/session/redis-session.store';
import { EmailProcessor, ExportProcessor, RealtimeEvictionProcessor } from 'src/queue/processors';
import {
  BillingScheduler,
  CleanupScheduler,
  DueDateScheduler,
  ScheduledExportScheduler,
} from 'src/queue/schedulers';
import {
  EmailQueueService,
  ExportQueueService,
  RealtimeEvictionQueueService,
} from 'src/queue/services';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { MailService } from 'src/mail/mail.service';

import { ActivityService } from 'src/activity/activity.service';
import { NotificationsService } from 'src/notifications/notifications.service';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ActivityService)
    .useValue({
      log: jest.fn().mockResolvedValue(undefined),
      listActivityLogs: jest.fn().mockResolvedValue({
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        data: [],
      }),
    })
    .overrideProvider(NotificationsService)
    .useValue({
      create: jest.fn().mockResolvedValue(undefined),
      getUserNotifications: jest.fn().mockResolvedValue({
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        data: [],
      }),
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(EmailQueueService)
    .useValue({
      addWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      addVerifyEmail: jest.fn().mockResolvedValue(undefined),
      addPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      addInvitationEmail: jest.fn().mockResolvedValue(undefined),
      addTaskAssignedEmail: jest.fn().mockResolvedValue(undefined),
      addMentionEmail: jest.fn().mockResolvedValue(undefined),
      addCommentEmail: jest.fn().mockResolvedValue(undefined),
      addDueReminderEmail: jest.fn().mockResolvedValue(undefined),
      addSubscriptionExpiryWarning: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(ExportQueueService)
    .useValue({
      addProjectTaskExportJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
      addWeeklyTasksReportJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
      addBiweeklyProjectsReportJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
      addMonthlyOrgReportJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    })
    .overrideProvider(RealtimeEvictionQueueService)
    .useValue({
      enqueueEviction: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    })
    .overrideProvider(CloudinaryService)
    .useValue({
      uploadBuffer: jest.fn().mockResolvedValue({ secureUrl: 'https://cloudinary.com/mock.jpg' }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(MailService)
    .useValue({
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      sendVerifyEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendReportEmail: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(EmailProcessor)
    .useValue({})
    .overrideProvider(ExportProcessor)
    .useValue({})
    .overrideProvider(RealtimeEvictionProcessor)
    .useValue({})
    .overrideProvider(DueDateScheduler)
    .useValue({})
    .overrideProvider(BillingScheduler)
    .useValue({})
    .overrideProvider(CleanupScheduler)
    .useValue({})
    .overrideProvider(ScheduledExportScheduler)
    .useValue({})
    .compile();

  const app = moduleFixture.createNestApplication();

  const redisService = app.get(RedisService);
  const store = new RedisSessionStore(redisService);

  app.use(requestIdMiddleware);
  app.use(
    session({
      name: 'app.sid',
      store,
      secret: process.env.SESSION_SECRET ?? 'test-session-secret-at-least-32-chars-long',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      },
    }),
  );

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

  await app.init();
  await app.listen(0, '127.0.0.1');
  return app;
}
