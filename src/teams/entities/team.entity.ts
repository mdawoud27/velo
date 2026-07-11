import { Team } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class TeamEntity implements Team {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  createdAt: Date;
  updatedAt: Date;

  @Exclude() deletedAt: Date | null;

  constructor(team: Team) {
    Object.assign(this, team);
  }
}
