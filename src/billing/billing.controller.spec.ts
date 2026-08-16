import { Test, TestingModule } from '@nestjs/testing';
import { Plan } from '@prisma/client';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

describe('BillingController', () => {
  let controller: BillingController;
  let service: jest.Mocked<BillingService>;

  beforeEach(async () => {
    const mockService = {
      createCheckoutSession: jest.fn(),
      createPortalSession: jest.fn(),
      getSubscriptionStatus: jest.fn(),
      handleStripeWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: mockService },
        { provide: Reflector, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
    service = module.get(BillingService);
  });

  it('createCheckout delegates to billingService', async () => {
    service.createCheckoutSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com' });

    const result = await controller.createCheckout({ plan: Plan.PRO }, { orgId: 'org-1' } as any);

    expect(service.createCheckoutSession).toHaveBeenCalledWith('org-1', Plan.PRO);
    expect(result).toEqual({ url: 'https://checkout.stripe.com' });
  });

  it('createPortal delegates to billingService', async () => {
    service.createPortalSession.mockResolvedValueOnce({ url: 'https://portal.stripe.com' });

    const result = await controller.createPortal({ orgId: 'org-1' } as any);

    expect(service.createPortalSession).toHaveBeenCalledWith('org-1');
    expect(result).toEqual({ url: 'https://portal.stripe.com' });
  });

  it('getSubscription delegates to billingService', async () => {
    const status = {
      plan: Plan.FREE,
      subscriptionId: null,
      currentPeriodEnd: null,
      isActive: false,
    };
    service.getSubscriptionStatus.mockResolvedValueOnce(status);

    const result = await controller.getSubscription({ orgId: 'org-1' } as any);

    expect(service.getSubscriptionStatus).toHaveBeenCalledWith('org-1');
    expect(result).toBe(status);
  });
});
