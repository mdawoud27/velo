import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class SubscriptionStatusDto {
  @ApiProperty({ enum: Plan, example: Plan.BUSINESS })
  plan: Plan;

  @ApiProperty({ nullable: true, example: 'sub_123' })
  subscriptionId: string | null;

  @ApiProperty({ nullable: true, example: '2025-01-01T00:00:00Z' })
  currentPeriodEnd: Date | null;

  @ApiProperty()
  isActive: boolean;
}
