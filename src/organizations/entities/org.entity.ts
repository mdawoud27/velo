import { Organization, Plan } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class OrgEntity implements Organization {
  id: string;
  name: string;
  description: string | null;
  plan: Plan;

  @Exclude() stripeCustomerId: string | null;
  @Exclude() stripeSubscriptionId: string | null;
  @Exclude() stripeCurrentPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
  @Exclude() deletedAt: Date | null;

  constructor(org: Organization) {
    Object.assign(this, org);
  }
}
