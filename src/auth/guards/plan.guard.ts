import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { PLAN_KEY } from '../decorators';
import { JwtPayload } from '../interfaces';
import { Plan } from '../types';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.get<Plan>(PLAN_KEY, context.getHandler());
    if (!requiredPlan) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();

    if (!user?.orgId) return false;

    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { plan: true },
    });

    if (!org) return false;

    const planHierarchy = ['FREE', 'PRO', 'BUSINESS'] as const;
    return planHierarchy.indexOf(org.plan) >= planHierarchy.indexOf(requiredPlan);
  }
}
