/**
 * Jest globalTeardown – runs once after ALL test suites finish.
 * Cleans every application table so no test data leaks into the database.
 */
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { assertSafeTestDatabaseUrl } from './database-safety';

export default async function globalTeardown() {
  const connectionString = process.env.DATABASE_URL ?? '';
  if (!connectionString) return;
  assertSafeTestDatabaseUrl(connectionString);

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "Attachment";
      DELETE FROM "Comment";
      DELETE FROM "TaskWatcher";
      DELETE FROM "ActivityLog";
      DELETE FROM "Notification";
      DELETE FROM "AuditLog";
      DELETE FROM "StripeEvent";
      DELETE FROM "Task";
      DELETE FROM "ProjectMember";
      DELETE FROM "Project";
      DELETE FROM "TeamMember";
      DELETE FROM "Team";
      DELETE FROM "OrgInvitation";
      DELETE FROM "OrgMember";
      DELETE FROM "Organization";
      DELETE FROM "User";
    `);
    console.info('\nGlobal teardown: all test data removed from database.');
  } catch (err) {
    console.error('Global teardown error:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
