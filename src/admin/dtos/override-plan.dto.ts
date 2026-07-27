import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class OverridePlanDto {
  @ApiProperty({ enum: Plan })
  @IsEnum(Plan)
  plan: Plan;
}
