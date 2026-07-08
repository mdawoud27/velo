import { Prisma } from '@prisma/client';

export class CreateActivityDto {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  projectId?: string;
  orgId?: string;
  metadata?: Prisma.InputJsonValue;
}
