import { BadRequestException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { BillingService } from './billing.service';

function makeConfig(configMap: Record<string, string> = {}) {
  const defaults = {
    STRIPE_PRO_PRICE_ID: 'price_pro_123',
    STRIPE_BUSINESS_PRICE_ID: 'price_biz_456',
    FRONTEND_URL: 'https://app.example.com',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    ...configMap,
  };
  return {
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      if (key in defaults) return defaults[key as keyof typeof defaults];
      throw new Error(`Missing config: ${key}`);
    }),
  } as any;
}

function makeStripe() {
  return {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_123' }),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal' }),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  } as any;
}

function makePrisma() {
  return {
    organization: {
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    stripeEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  } as any;
}

function makeRedis() {
  return {
    acquireLock: jest.fn().mockResolvedValue('token-123'),
    releaseLock: jest.fn().mockResolvedValue(true),
  } as any;
}

function makeActivity() {
  return { log: jest.fn() } as any;
}

function makeLogger() {
  return { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

describe('BillingService', () => {
  let service: BillingService;
  let stripe: ReturnType<typeof makeStripe>;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    stripe = makeStripe();
    prisma = makePrisma();
    redis = makeRedis();
    service = new BillingService(stripe, prisma, redis, makeConfig(), makeActivity(), makeLogger());
  });

  describe('createCheckoutSession', () => {
    it('throws BadRequestException for FREE plan', async () => {
      await expect(service.createCheckoutSession('org-1', Plan.FREE)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if organization is already on that plan', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'org-1',
        plan: Plan.PRO,
        stripeCustomerId: 'cus_123',
      });

      await expect(service.createCheckoutSession('org-1', Plan.PRO)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a checkout session and returns URL', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'org-1',
        plan: Plan.FREE,
        stripeCustomerId: 'cus_123',
      });

      const result = await service.createCheckoutSession('org-1', Plan.PRO);

      expect(result).toEqual({ url: 'https://checkout.stripe.com/pay/cs_123' });
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_123',
          mode: 'subscription',
        }),
      );
    });
  });

  describe('createPortalSession', () => {
    it('throws BadRequestException if org has no stripeCustomerId', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'org-1',
        stripeCustomerId: null,
      });

      await expect(service.createPortalSession('org-1')).rejects.toThrow(BadRequestException);
    });

    it('creates a billing portal session and returns URL', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'org-1',
        stripeCustomerId: 'cus_123',
      });

      const result = await service.createPortalSession('org-1');

      expect(result).toEqual({ url: 'https://billing.stripe.com/portal' });
      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'https://app.example.com/settings/billing',
      });
    });
  });

  describe('getSubscriptionStatus', () => {
    it('returns org subscription status', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValueOnce({
        plan: Plan.PRO,
        stripeSubscriptionId: 'sub_123',
        stripeCurrentPeriodEnd: new Date('2026-12-31'),
      });

      const result = await service.getSubscriptionStatus('org-1');

      expect(result).toEqual({
        plan: Plan.PRO,
        subscriptionId: 'sub_123',
        currentPeriodEnd: new Date('2026-12-31'),
        isActive: true,
      });
    });
  });
});
