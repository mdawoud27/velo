import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health - returns health check status', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data).toHaveProperty('version');
    expect(res.body.data.info.prisma.status).toBe('up');
    expect(res.body.data.info.redis.status).toBe('up');
  });
});
