import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { resetDatabase } from './support/db.helper';
import { createUser } from './support/factories/user.factory';
import { getAuthHeader } from './support/auth.helper';

describe('AuthController (e2e)', () => {
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

  // ─── REGISTER ────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user successfully', async () => {
      const dto = {
        name: 'Alice',
        email: 'alice@example.com',
        password: 'Password123!',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(dto)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Check your inbox');

      const user = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });
      expect(user).toBeDefined();
      expect(user?.isEmailVerified).toBe(false);
    });

    it('returns 409 if email is already registered', async () => {
      await createUser(prisma, { email: 'duplicate@example.com' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Alice',
          email: 'duplicate@example.com',
          password: 'Password123!',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('returns 422 for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'incomplete@example.com' })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 for invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Bad Email', email: 'not-an-email', password: 'Password123!' })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('returns 422 for weak password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Weak', email: 'weak@example.com', password: '123' })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('trims whitespace from email before saving', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Trim Test', email: '  trimtest@example.com  ', password: 'Password123!' })
        .expect(201);

      const user = await prisma.user.findUnique({ where: { email: 'trimtest@example.com' } });
      expect(user).toBeDefined();
    });
  });

  // ─── LOGIN ────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('authenticates verified user and returns tokens', async () => {
      await createUser(prisma, {
        email: 'login@example.com',
        isEmailVerified: true,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'Password123!' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('login@example.com');
    });

    it('returns 401 for wrong password', async () => {
      await createUser(prisma, { email: 'wrongpw@example.com', isEmailVerified: true });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'wrongpw@example.com', password: 'WrongPassword123!' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('returns 401 for non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password123!' })
        .expect(401);
    });

    it('returns 403 for unverified email', async () => {
      await createUser(prisma, { email: 'unverified@example.com', isEmailVerified: false });

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'unverified@example.com', password: 'Password123!' })
        .expect(403);
    });

    it('returns 422 for missing credentials', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({}).expect(422);
    });
  });

  // ─── REFRESH TOKEN ──────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh-token', () => {
    it('issues new tokens with valid refresh token', async () => {
      await createUser(prisma, { email: 'refresh@example.com', isEmailVerified: true });

      // Login to get initial tokens
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'refresh@example.com', password: 'Password123!' })
        .expect(200);

      const { refreshToken } = loginRes.body.data;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      // New tokens should be different from original
      expect(res.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('returns 400 for invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'invalid-token-string' })
        .expect(400);
    });

    it('prevents reuse of already-consumed refresh token', async () => {
      await createUser(prisma, { email: 'reuse@example.com', isEmailVerified: true });

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'reuse@example.com', password: 'Password123!' })
        .expect(200);

      const { refreshToken } = loginRes.body.data;

      // First refresh should succeed
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      // Second use of same token should fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken })
        .expect(401);
    });
  });

  // ─── FORGOT / RESET PASSWORD ────────────────────────────────────

  describe('Forgot → Reset password flow', () => {
    it('POST /api/v1/auth/forgot-password returns success even for unknown email (no information leak)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'unknown@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/auth/forgot-password returns 403 for unverified email', async () => {
      await createUser(prisma, { email: 'unverified-forgot@example.com', isEmailVerified: false });

      await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'unverified-forgot@example.com' })
        .expect(403);
    });

    it('POST /api/v1/auth/reset-password returns error for invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: 'invalid-reset-token', newPassword: 'NewPassword123!' })
        .expect(400);
    });
  });

  // ─── LOGOUT ──────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('logs out authenticated user', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set(headers)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    });

    it('returns 401 with invalid bearer token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set({ Authorization: 'Bearer invalid-jwt-token' })
        .expect(401);
    });
  });

  // ─── RESEND VERIFICATION ────────────────────────────────────────

  describe('POST /api/v1/auth/resend-verification-email', () => {
    it('returns success for existing unverified user', async () => {
      await createUser(prisma, { email: 'resend@example.com', isEmailVerified: false });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification-email')
        .send({ email: 'resend@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns success even for already verified user (no info leak)', async () => {
      await createUser(prisma, { email: 'verified@example.com', isEmailVerified: true });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification-email')
        .send({ email: 'verified@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
