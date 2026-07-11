import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PlanGuard } from '../guards/plan.guard';
import type { Plan } from '../types';

export const PLAN_KEY = 'plan';

export const RequiresPlan = (plan: Plan) =>
  applyDecorators(SetMetadata(PLAN_KEY, plan), UseGuards(PlanGuard));
