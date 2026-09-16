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

describe('Authorization & Multi-Tenancy (e2e)', () => {
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

  it('prevents user in Org A from creating tasks in Org B (BOLA/IDOR protection)', async () => {
    // User A in Org A
    const userA = await createUser(prisma, { email: 'usera@orga.com' });
    const orgA = await createOrganization(prisma, userA.id, { name: 'Org A' });
    const headersA = await getAuthHeader(app, userA, { orgId: orgA.id, role: 'OWNER' });

    // User B in Org B
    const userB = await createUser(prisma, { email: 'userb@orgb.com' });
    const orgB = await createOrganization(prisma, userB.id, { name: 'Org B' });
    const teamB = await createTeam(prisma, orgB.id, userB.id, { name: 'Team B' });
    const projectB = await createProject(prisma, teamB.id, userB.id, { name: 'Project B' });

    // User A attempts to create a task inside Org B's project
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgB.id}/teams/${teamB.id}/projects/${projectB.id}/tasks`)
      .set(headersA)
      .send({ title: 'Hacked Task' });

    expect([403, 404]).toContain(res.status);
  });

  it('prevents user in Org A from reading teams in Org B', async () => {
    const userA = await createUser(prisma, { email: 'usera2@orga.com' });
    const orgA = await createOrganization(prisma, userA.id);
    const headersA = await getAuthHeader(app, userA, { orgId: orgA.id, role: 'OWNER' });

    const userB = await createUser(prisma, { email: 'userb2@orgb.com' });
    const orgB = await createOrganization(prisma, userB.id);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB.id}/teams`)
      .set(headersA);

    expect([403, 404]).toContain(res.status);
  });

  it('prevents user in Org A from reading projects in Org B', async () => {
    const userA = await createUser(prisma, { email: 'usera3@orga.com' });
    const orgA = await createOrganization(prisma, userA.id);
    const headersA = await getAuthHeader(app, userA, { orgId: orgA.id, role: 'OWNER' });

    const userB = await createUser(prisma, { email: 'userb3@orgb.com' });
    const orgB = await createOrganization(prisma, userB.id);
    const teamB = await createTeam(prisma, orgB.id, userB.id);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB.id}/teams/${teamB.id}/projects`)
      .set(headersA);

    expect([403, 404]).toContain(res.status);
  });

  it('prevents user in Org A from accessing comments in Org B', async () => {
    const userA = await createUser(prisma, { email: 'usera4@orga.com' });
    const orgA = await createOrganization(prisma, userA.id);
    const headersA = await getAuthHeader(app, userA, { orgId: orgA.id, role: 'OWNER' });

    const userB = await createUser(prisma, { email: 'userb4@orgb.com' });
    const orgB = await createOrganization(prisma, userB.id);
    const teamB = await createTeam(prisma, orgB.id, userB.id);
    const projectB = await createProject(prisma, teamB.id, userB.id);
    const taskB = await createTask(prisma, projectB.id, userB.id);

    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${orgB.id}/teams/${teamB.id}/projects/${projectB.id}/tasks/${taskB.id}/comments`,
      )
      .set(headersA);

    expect([403, 404]).toContain(res.status);
  });
});
