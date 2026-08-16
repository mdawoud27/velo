import { Plan } from '@prisma/client';
import { PlanGuard } from './plan.guard';

function makeContext(user?: { orgId?: string }) {
  return {
    getHandler: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

function makeReflector(requiredPlan: Plan | undefined) {
  return { get: jest.fn().mockReturnValue(requiredPlan) } as any;
}

function makePrisma(plan: Plan | null) {
  return {
    organization: {
      findUnique: jest.fn().mockResolvedValue(plan ? { plan } : null),
    },
  } as any;
}

describe('PlanGuard', () => {
  it('returns true when no plan requirement is set on the handler', async () => {
    const guard = new PlanGuard(makeReflector(undefined), makePrisma(null));
    const result = await guard.canActivate(makeContext({ orgId: 'org-1' }));
    expect(result).toBe(true);
  });

  it('returns false when user has no orgId', async () => {
    const guard = new PlanGuard(makeReflector(Plan.PRO), makePrisma(Plan.FREE));
    const result = await guard.canActivate(makeContext({ orgId: undefined }));
    expect(result).toBe(false);
  });

  it('returns false when the organization is not found', async () => {
    const guard = new PlanGuard(makeReflector(Plan.PRO), makePrisma(null));
    const result = await guard.canActivate(makeContext({ orgId: 'org-1' }));
    expect(result).toBe(false);
  });

  describe('plan hierarchy (FREE < PRO < BUSINESS)', () => {
    it('allows FREE org to access a FREE-required route', async () => {
      const guard = new PlanGuard(makeReflector(Plan.FREE), makePrisma(Plan.FREE));
      expect(await guard.canActivate(makeContext({ orgId: 'o' }))).toBe(true);
    });

    it('denies FREE org from accessing a PRO-required route', async () => {
      const guard = new PlanGuard(makeReflector(Plan.PRO), makePrisma(Plan.FREE));
      expect(await guard.canActivate(makeContext({ orgId: 'o' }))).toBe(false);
    });

    it('allows PRO org to access a PRO-required route', async () => {
      const guard = new PlanGuard(makeReflector(Plan.PRO), makePrisma(Plan.PRO));
      expect(await guard.canActivate(makeContext({ orgId: 'o' }))).toBe(true);
    });

    it('allows BUSINESS org to access a PRO-required route', async () => {
      const guard = new PlanGuard(makeReflector(Plan.PRO), makePrisma(Plan.BUSINESS));
      expect(await guard.canActivate(makeContext({ orgId: 'o' }))).toBe(true);
    });

    it('denies FREE org from accessing a BUSINESS-required route', async () => {
      const guard = new PlanGuard(makeReflector(Plan.BUSINESS), makePrisma(Plan.FREE));
      expect(await guard.canActivate(makeContext({ orgId: 'o' }))).toBe(false);
    });

    it('denies PRO org from accessing a BUSINESS-required route', async () => {
      const guard = new PlanGuard(makeReflector(Plan.BUSINESS), makePrisma(Plan.PRO));
      expect(await guard.canActivate(makeContext({ orgId: 'o' }))).toBe(false);
    });

    it('allows BUSINESS org to access a BUSINESS-required route', async () => {
      const guard = new PlanGuard(makeReflector(Plan.BUSINESS), makePrisma(Plan.BUSINESS));
      expect(await guard.canActivate(makeContext({ orgId: 'o' }))).toBe(true);
    });
  });
});
