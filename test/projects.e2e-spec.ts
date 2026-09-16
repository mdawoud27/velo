import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { resetDatabase } from './support/db.helper';
import { createUser } from './support/factories/user.factory';
import { createOrganization } from './support/factories/organization.factory';
import { createTeam } from './support/factories/team.factory';
import { createProject } from './support/factories/project.factory';
import { getAuthHeader } from './support/auth.helper';

describe('ProjectsController (e2e)', () => {
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

  async function setupTeam() {
    const user = await createUser(prisma);
    const org = await createOrganization(prisma, user.id);
    const team = await createTeam(prisma, org.id, user.id);
    const headers = await getAuthHeader(app, user, { orgId: org.id, role: 'OWNER' });
    return { user, org, team, headers };
  }

  function projectUrl(orgId: string, teamId: string, projectId?: string) {
    const base = `/api/v1/organizations/${orgId}/teams/${teamId}/projects`;
    return projectId ? `${base}/${projectId}` : base;
  }

  describe('POST .../projects', () => {
    it('creates project inside team', async () => {
      const { org, team, headers } = await setupTeam();
      const res = await request(app.getHttpServer())
        .post(projectUrl(org.id, team.id))
        .set(headers)
        .send({ name: 'Velo Web' })
        .expect(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Velo Web');
    });

    it('returns 422 for missing project name', async () => {
      const { org, team, headers } = await setupTeam();
      await request(app.getHttpServer())
        .post(projectUrl(org.id, team.id))
        .set(headers)
        .send({})
        .expect(422);
    });
  });

  describe('GET .../projects', () => {
    it('lists projects in team', async () => {
      const { org, team, headers } = await setupTeam();
      await createProject(prisma, team.id, undefined, { name: 'P1' });
      await createProject(prisma, team.id, undefined, { name: 'P2' });

      const res = await request(app.getHttpServer())
        .get(projectUrl(org.id, team.id))
        .set(headers)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET .../projects/:id', () => {
    it('returns project details', async () => {
      const { org, team, headers } = await setupTeam();
      const project = await createProject(prisma, team.id, undefined, { name: 'Detail Project' });

      const res = await request(app.getHttpServer())
        .get(projectUrl(org.id, team.id, project.id))
        .set(headers)
        .expect(200);
      expect(res.body.data.name).toBe('Detail Project');
    });
  });

  describe('PATCH .../projects/:id', () => {
    it('updates project name', async () => {
      const { org, team, headers } = await setupTeam();
      const project = await createProject(prisma, team.id, undefined, { name: 'Old Name' });

      const res = await request(app.getHttpServer())
        .patch(projectUrl(org.id, team.id, project.id))
        .set(headers)
        .send({ name: 'New Name' })
        .expect(200);
      expect(res.body.data.name).toBe('New Name');
    });
  });

  describe('GET .../projects/:id/board', () => {
    it('returns Kanban board', async () => {
      const { org, team, headers } = await setupTeam();
      const project = await createProject(prisma, team.id, undefined, { name: 'Board Project' });

      const res = await request(app.getHttpServer())
        .get(`${projectUrl(org.id, team.id, project.id)}/board`)
        .set(headers)
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET .../projects/:id/summary', () => {
    it('returns project summary', async () => {
      const { org, team, headers } = await setupTeam();
      const project = await createProject(prisma, team.id, undefined, { name: 'Summary Project' });

      const res = await request(app.getHttpServer())
        .get(`${projectUrl(org.id, team.id, project.id)}/summary`)
        .set(headers)
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE .../projects/:id', () => {
    it('soft-deletes an archived project', async () => {
      const { org, team, headers } = await setupTeam();
      const project = await createProject(prisma, team.id, undefined, { status: 'ARCHIVED' });

      await request(app.getHttpServer())
        .delete(projectUrl(org.id, team.id, project.id))
        .set(headers)
        .expect(200);

      const p = await prisma.project.findUnique({ where: { id: project.id } });
      expect(p?.deletedAt).not.toBeNull();
    });
  });
});
