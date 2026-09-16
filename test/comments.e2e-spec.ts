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

describe('CommentsController (e2e)', () => {
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

  async function setupTask() {
    const user = await createUser(prisma);
    const org = await createOrganization(prisma, user.id);
    const team = await createTeam(prisma, org.id, user.id);
    const project = await createProject(prisma, team.id, user.id);
    const task = await createTask(prisma, project.id, user.id);
    const headers = await getAuthHeader(app, user, { orgId: org.id, role: 'OWNER' });
    return { user, org, team, project, task, headers };
  }

  function commentsUrl(
    orgId: string,
    teamId: string,
    projectId: string,
    taskId: string,
    commentId?: string,
  ) {
    const base = `/api/v1/organizations/${orgId}/teams/${teamId}/projects/${projectId}/tasks/${taskId}/comments`;
    return commentId ? `${base}/${commentId}` : base;
  }

  describe('POST .../comments', () => {
    it('creates comment on task', async () => {
      const { org, team, project, task, headers } = await setupTask();

      const res = await request(app.getHttpServer())
        .post(commentsUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .send({ body: 'Looks good to me!' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.body).toBe('Looks good to me!');
    });

    it('returns 422 for empty comment body', async () => {
      const { org, team, project, task, headers } = await setupTask();

      await request(app.getHttpServer())
        .post(commentsUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .send({ body: '' })
        .expect(422);
    });
  });

  describe('GET .../comments', () => {
    it('lists comments for task', async () => {
      const { org, team, project, task, headers } = await setupTask();

      await request(app.getHttpServer())
        .post(commentsUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .send({ body: 'First comment' });

      await request(app.getHttpServer())
        .post(commentsUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .send({ body: 'Second comment' });

      const res = await request(app.getHttpServer())
        .get(commentsUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PATCH .../comments/:id', () => {
    it('updates own comment body', async () => {
      const { org, team, project, task, headers } = await setupTask();

      const createRes = await request(app.getHttpServer())
        .post(commentsUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .send({ body: 'Original comment' });

      const commentId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .patch(commentsUrl(org.id, team.id, project.id, task.id, commentId))
        .set(headers)
        .send({ body: 'Updated comment body' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.body).toBe('Updated comment body');
    });
  });

  describe('DELETE .../comments/:id', () => {
    it('soft deletes comment', async () => {
      const { org, team, project, task, headers } = await setupTask();

      const createRes = await request(app.getHttpServer())
        .post(commentsUrl(org.id, team.id, project.id, task.id))
        .set(headers)
        .send({ body: 'Comment to be deleted' });

      const commentId = createRes.body.data.id;

      await request(app.getHttpServer())
        .delete(commentsUrl(org.id, team.id, project.id, task.id, commentId))
        .set(headers)
        .expect(200);

      const comment = await prisma.comment.findUnique({ where: { id: commentId } });
      expect(comment?.deletedAt).not.toBeNull();
    });
  });
});
