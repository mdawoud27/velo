import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { resetDatabase } from './support/db.helper';
import { createUser } from './support/factories/user.factory';
import { createOrganization } from './support/factories/organization.factory';
import { getAuthHeader } from './support/auth.helper';

describe('TeamsController (e2e)', () => {
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

  async function setupOrgOwner() {
    const user = await createUser(prisma);
    const org = await createOrganization(prisma, user.id);
    const headers = await getAuthHeader(app, user, { orgId: org.id, role: 'OWNER' });
    return { user, org, headers };
  }

  describe('POST /api/v1/organizations/:orgId/teams', () => {
    it('creates team inside org', async () => {
      const { org, headers } = await setupOrgOwner();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .send({ name: 'Backend Engineering' })
        .expect(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Backend Engineering');
    });

    it('422 for missing name', async () => {
      const { org, headers } = await setupOrgOwner();
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .send({})
        .expect(422);
    });
  });

  describe('GET /api/v1/organizations/:orgId/teams', () => {
    it('lists teams in organization', async () => {
      const { org, headers } = await setupOrgOwner();
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .send({ name: 'Team A' });
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .send({ name: 'Team B' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/v1/organizations/:orgId/teams/:id', () => {
    it('returns team details', async () => {
      const { org, headers } = await setupOrgOwner();
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .send({ name: 'Detail Team' });
      const teamId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${org.id}/teams/${teamId}`)
        .set(headers)
        .expect(200);
      expect(res.body.data.name).toBe('Detail Team');
    });
  });

  describe('PATCH /api/v1/organizations/:orgId/teams/:id', () => {
    it('updates team name', async () => {
      const { org, headers } = await setupOrgOwner();
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .send({ name: 'Old Name' });
      const teamId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${org.id}/teams/${teamId}`)
        .set(headers)
        .send({ name: 'New Name' })
        .expect(200);
      expect(res.body.data.name).toBe('New Name');
    });
  });

  describe('DELETE /api/v1/organizations/:orgId/teams/:id', () => {
    it('soft-deletes team', async () => {
      const { org, headers } = await setupOrgOwner();
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .send({ name: 'Deletable Team' });
      const teamId = createRes.body.data.id;

      await request(app.getHttpServer())
        .delete(`/api/v1/organizations/${org.id}/teams/${teamId}`)
        .set(headers)
        .expect(200);

      const team = await prisma.team.findUnique({ where: { id: teamId } });
      expect(team?.deletedAt).not.toBeNull();
    });
  });

  describe('Team member management', () => {
    it('adds and lists team members', async () => {
      const { user, org, headers } = await setupOrgOwner();
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .send({ name: 'Membership Team' });
      const teamId = createRes.body.data.id;

      // Add org owner to team as well
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams/${teamId}/members`)
        .set(headers)
        .send({ userId: user.id, role: 'LEAD' })
        .expect(201);

      // Add another user
      const member = await createUser(prisma);
      await prisma.orgMember.create({ data: { userId: member.id, orgId: org.id, role: 'MEMBER' } });

      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams/${teamId}/members`)
        .set(headers)
        .send({ userId: member.id, role: 'MEMBER' })
        .expect(201);

      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${org.id}/teams/${teamId}/members`)
        .set(headers)
        .expect(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('removes team member', async () => {
      const { org, headers } = await setupOrgOwner();
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams`)
        .set(headers)
        .send({ name: 'Remove Member Team' });
      const teamId = createRes.body.data.id;

      const member = await createUser(prisma);
      await prisma.orgMember.create({ data: { userId: member.id, orgId: org.id, role: 'MEMBER' } });
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.id}/teams/${teamId}/members`)
        .set(headers)
        .send({ userId: member.id, role: 'MEMBER' });

      await request(app.getHttpServer())
        .delete(`/api/v1/organizations/${org.id}/teams/${teamId}/members/${member.id}`)
        .set(headers)
        .expect(200);
    });
  });
});
