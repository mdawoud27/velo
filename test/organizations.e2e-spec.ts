import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { resetDatabase } from './support/db.helper';
import { createUser } from './support/factories/user.factory';
import { createOrganization } from './support/factories/organization.factory';
import { getAuthHeader } from './support/auth.helper';

describe('OrganizationsController (e2e)', () => {
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

  describe('POST /api/v1/organizations', () => {
    it('creates org; creator becomes OWNER', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);

      const res = await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(headers)
        .send({ name: 'Acme Corp', description: 'Tech giant' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Acme Corp');

      const member = await prisma.orgMember.findFirst({
        where: { userId: user.id, orgId: res.body.data.id },
      });
      expect(member?.role).toBe('OWNER');
    });

    it('422 for missing name', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(headers)
        .send({ description: 'no name' })
        .expect(422);
    });

    it('401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .send({ name: 'X' })
        .expect(401);
    });
  });

  describe('GET /api/v1/organizations/me', () => {
    it('lists user orgs', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(headers)
        .send({ name: 'Org One' });
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(headers)
        .send({ name: 'Org Two' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/organizations/me')
        .set(headers)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('empty list for new user', async () => {
      const user = await createUser(prisma);
      const headers = await getAuthHeader(app, user);
      const res = await request(app.getHttpServer())
        .get('/api/v1/organizations/me')
        .set(headers)
        .expect(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/v1/organizations/:orgId/invite', () => {
    it('OWNER can send invitation', async () => {
      const owner = await createUser(prisma);
      const org = await createOrganization(prisma, owner.id);
      await createUser(prisma, { email: 'invitee@example.com' });
      const headers = await getAuthHeader(app, owner, { orgId: org.id, role: 'OWNER' });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/invite`)
        .set(headers)
        .send({ email: 'invitee@example.com', role: 'MEMBER' })
        .expect(201);
      expect(res.body.success).toBe(true);
    });

    it('MEMBER cannot send invitation (403)', async () => {
      const owner = await createUser(prisma);
      const org = await createOrganization(prisma, owner.id);
      const member = await createUser(prisma);
      await createUser(prisma, { email: 'x@x.com' });
      await prisma.orgMember.create({ data: { userId: member.id, orgId: org.id, role: 'MEMBER' } });
      const h = await getAuthHeader(app, member, { orgId: org.id, role: 'MEMBER' });

      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/invite`)
        .set(h)
        .send({ email: 'x@x.com', role: 'MEMBER' })
        .expect(403);
    });
  });

  describe('POST /api/v1/organizations/:orgId/accept', () => {
    it('accepts invitation with valid token', async () => {
      const owner = await createUser(prisma);
      const org = await createOrganization(prisma, owner.id);
      const invitee = await createUser(prisma);

      const inv = await prisma.orgInvitation.create({
        data: {
          orgId: org.id,
          email: invitee.email,
          token: 'tok-1',
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 86400000),
          invitedById: owner.id,
        },
      });

      const h = await getAuthHeader(app, invitee);
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/accept`)
        .set(h)
        .send({ token: inv.token })
        .expect(200);
      expect(res.body.success).toBe(true);

      const m = await prisma.orgMember.findFirst({ where: { userId: invitee.id, orgId: org.id } });
      expect(m?.role).toBe('MEMBER');
    });
  });
});
