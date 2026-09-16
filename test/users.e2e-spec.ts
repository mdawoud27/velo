import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app';
import { PrismaService } from 'src/prisma/prisma.service';
import { resetDatabase } from './support/db.helper';
import { createUser } from './support/factories/user.factory';
import { getAuthHeader } from './support/auth.helper';

import { RedisService } from 'src/redis/redis.service';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma, redis);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/users/me', () => {
    it('returns profile of current user', async () => {
      const user = await createUser(prisma, { name: 'Current User' });
      const headers = await getAuthHeader(app, user);

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set(headers)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Current User');
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('updates current user profile', async () => {
      const user = await createUser(prisma, { name: 'Old Name' });
      const headers = await getAuthHeader(app, user);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set(headers)
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Name');
    });
  });

  describe('GET & PATCH /api/v1/users/me/notification-preferences', () => {
    it('gets default notification preferences', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me/notification-preferences')
        .set(headers)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('updates notification preferences', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me/notification-preferences')
        .set(headers)
        .send({ emailOnTaskAssigned: false, emailOnComment: true })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('PATCH /api/v1/users/me/password', () => {
    it('updates password successfully with correct current password', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .set(headers)
        .send({ currentPassword: 'Password123!', newPassword: 'BrandNewPassword123!' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 401 when old password is incorrect', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);

      await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .set(headers)
        .send({ currentPassword: 'WrongPassword123!', newPassword: 'BrandNewPassword123!' })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/users/me', () => {
    it('soft deletes user account', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);

      const res = await request(app.getHttpServer())
        .delete('/api/v1/users/me')
        .set(headers)
        .expect(200);

      expect(res.body.success).toBe(true);

      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updatedUser?.deletedAt).not.toBeNull();
    });
  });
});
