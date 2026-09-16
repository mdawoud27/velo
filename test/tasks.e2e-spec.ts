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
import { createTask } from './support/factories/task.factory';
import { getAuthHeader } from './support/auth.helper';

describe('TasksController (e2e)', () => {
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

  async function setupProject() {
    const user = await createUser(prisma);
    const org = await createOrganization(prisma, user.id);
    const team = await createTeam(prisma, org.id, user.id);
    const project = await createProject(prisma, team.id, user.id);
    const headers = await getAuthHeader(app, user, { orgId: org.id, role: 'OWNER' });
    return { user, org, team, project, headers };
  }

  function taskUrl(orgId: string, teamId: string, projectId: string, taskId?: string) {
    const base = `/api/v1/organizations/${orgId}/teams/${teamId}/projects/${projectId}/tasks`;
    return taskId ? `${base}/${taskId}` : base;
  }

  // ─── CREATE ───────────────────────────────────────────────────────

  describe('POST .../tasks', () => {
    it('creates task within project', async () => {
      const { org, team, project, headers } = await setupProject();
      const res = await request(app.getHttpServer())
        .post(taskUrl(org.id, team.id, project.id))
        .set(headers)
        .send({ title: 'Implement E2E Tests', priority: 'HIGH' })
        .expect(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Implement E2E Tests');
      expect(res.body.data.priority).toBe('HIGH');
    });

    it('422 for missing title', async () => {
      const { org, team, project, headers } = await setupProject();
      await request(app.getHttpServer())
        .post(taskUrl(org.id, team.id, project.id))
        .set(headers)
        .send({ priority: 'LOW' })
        .expect(422);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET .../tasks', () => {
    it('lists tasks in project', async () => {
      const { user, org, team, project, headers } = await setupProject();
      await createTask(prisma, project.id, user.id, { title: 'T1' });
      await createTask(prisma, project.id, user.id, { title: 'T2' });

      const res = await request(app.getHttpServer())
        .get(taskUrl(org.id, team.id, project.id))
        .set(headers)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── GET SINGLE ───────────────────────────────────────────────────

  describe('GET .../tasks/:id', () => {
    it('returns task details', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id, { title: 'Detail Task' });

      const res = await request(app.getHttpServer())
        .get(taskUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .expect(200);
      expect(res.body.data.title).toBe('Detail Task');
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('PATCH .../tasks/:id', () => {
    it('updates task title and description', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id, { title: 'Old Title' });

      const res = await request(app.getHttpServer())
        .patch(taskUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .send({ title: 'New Title', description: 'Now with a description' })
        .expect(200);
      expect(res.body.data.title).toBe('New Title');
      expect(res.body.data.description).toBe('Now with a description');
    });
  });

  // ─── STATUS TRANSITIONS ──────────────────────────────────────────

  describe('PATCH .../tasks/:id/status', () => {
    it('valid: TODO → IN_PROGRESS', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id, { status: 'TODO' });

      const res = await request(app.getHttpServer())
        .patch(`${taskUrl(org.id, team.id, project.id, task.id)}/status`)
        .set(headers)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('valid: full lifecycle TODO → IN_PROGRESS → IN_REVIEW → DONE', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id, { status: 'TODO' });
      const statusUrl = `${taskUrl(org.id, team.id, project.id, task.id)}/status`;

      await request(app.getHttpServer())
        .patch(statusUrl)
        .set(headers)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(statusUrl)
        .set(headers)
        .send({ status: 'IN_REVIEW' })
        .expect(200);
      const res = await request(app.getHttpServer())
        .patch(statusUrl)
        .set(headers)
        .send({ status: 'DONE' })
        .expect(200);
      expect(res.body.data.status).toBe('DONE');
    });

    it('invalid: TODO → DONE (skip steps)', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id, { status: 'TODO' });

      await request(app.getHttpServer())
        .patch(`${taskUrl(org.id, team.id, project.id, task.id)}/status`)
        .set(headers)
        .send({ status: 'DONE' })
        .expect(422);
    });

    it('invalid: TODO → IN_REVIEW (skip steps)', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id, { status: 'TODO' });

      await request(app.getHttpServer())
        .patch(`${taskUrl(org.id, team.id, project.id, task.id)}/status`)
        .set(headers)
        .send({ status: 'IN_REVIEW' })
        .expect(422);
    });
  });

  // ─── TAGS ─────────────────────────────────────────────────────────

  describe('PATCH/DELETE .../tasks/:id/tags', () => {
    it('adds tags to a task', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id);

      const res = await request(app.getHttpServer())
        .patch(`${taskUrl(org.id, team.id, project.id, task.id)}/tags`)
        .set(headers)
        .send({ tags: ['bug', 'frontend'] })
        .expect(200);
      expect(res.body.data.tags).toEqual(expect.arrayContaining(['bug', 'frontend']));
    });

    it('removes tags from a task', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id, { tags: ['bug', 'remove-me'] });

      const res = await request(app.getHttpServer())
        .delete(`${taskUrl(org.id, team.id, project.id, task.id)}/tags`)
        .set(headers)
        .send({ tags: ['remove-me'] })
        .expect(200);
      expect(res.body.data.tags).toContain('bug');
      expect(res.body.data.tags).not.toContain('remove-me');
    });
  });

  // ─── WATCHERS ─────────────────────────────────────────────────────

  describe('POST/DELETE .../tasks/:id/watch', () => {
    it('watches and unwatches a task', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id);

      await request(app.getHttpServer())
        .post(`${taskUrl(org.id, team.id, project.id, task.id)}/watch`)
        .set(headers)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`${taskUrl(org.id, team.id, project.id, task.id)}/watch`)
        .set(headers)
        .expect(200);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE .../tasks/:id', () => {
    it('soft-deletes task', async () => {
      const { user, org, team, project, headers } = await setupProject();
      const task = await createTask(prisma, project.id, user.id);

      await request(app.getHttpServer())
        .delete(taskUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .expect(200);

      const updated = await prisma.task.findUnique({ where: { id: task.id } });
      expect(updated?.deletedAt).not.toBeNull();
    });
  });

  // ─── SEARCH ───────────────────────────────────────────────────────

  describe('GET .../tasks/search', () => {
    it('searches tasks by title', async () => {
      const { user, org, team, project, headers } = await setupProject();
      await createTask(prisma, project.id, user.id, { title: 'Unique Searchable Title' });

      const res = await request(app.getHttpServer())
        .get(`${taskUrl(org.id, team.id, project.id)}/search?query=Searchable`)
        .set(headers)
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });
});
