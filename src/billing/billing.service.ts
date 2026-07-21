import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Plan } from '@prisma/client';
import { LoggerService } from 'src/logger/logger.service';
import Stripe from 'stripe';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { ActivityService } from 'src/activity/activity.service';
import { STRIPE_CLIENT } from './constants';

@Injectable()
export class BillingService {
  private readonly planMap: Record<string, Plan>;

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
    private readonly logger: LoggerService,
  ) {
    this.planMap = {
      [config.getOrThrow('STRIPE_PRO_PRICE_ID')]: Plan.PRO,
      [config.getOrThrow('STRIPE_BUSINESS_PRICE_ID')]: Plan.BUSINESS,
    };
  }

  async createCheckoutSession(orgId: string, plan: Plan): Promise<{ url: string }> {
    if (plan === Plan.FREE) {
      throw new BadRequestException('Cannot create a checkout session for the FREE plan');
    }

    const priceMap: Partial<Record<Plan, string>> = {
      [Plan.PRO]: this.config.getOrThrow('STRIPE_PRO_PRICE_ID'),
      [Plan.BUSINESS]: this.config.getOrThrow('STRIPE_BUSINESS_PRICE_ID'),
    };
    const priceId = priceMap[plan];
    if (!priceId) {
      throw new BadRequestException(`No price configured for plan: ${plan}`);
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

    if (org.plan === plan) {
      throw new BadRequestException(`Organization is already on the ${plan} plan`);
    }

    // Lazy Stripe customer creation
    const customerId = org.stripeCustomerId ?? (await this.getOrCreateCustomer(orgId, org));

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.config.getOrThrow('CLIENT_URL')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.config.getOrThrow('CLIENT_URL')}/billing/cancelled`,
      metadata: { orgId },
      subscription_data: {
        metadata: { orgId }, // also on the subscription for lookup via subscription.updated
      },
    });

    if (!session.url) {
      throw new InternalServerErrorException('Stripe did not return a checkout URL');
    }

    return { url: session.url };
  }

  async createPortalSession(orgId: string): Promise<{ url: string }> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

    if (!org.stripeCustomerId) {
      throw new BadRequestException('No billing account found. Start a subscription first.');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${this.config.getOrThrow('CLIENT_URL')}/settings/billing`,
    });

    return { url: session.url };
  }

  async getSubscriptionStatus(orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        plan: true,
        stripeSubscriptionId: true,
        stripeCurrentPeriodEnd: true,
      },
    });

    return {
      plan: org.plan,
      subscriptionId: org.stripeSubscriptionId,
      currentPeriodEnd: org.stripeCurrentPeriodEnd,
      isActive: org.plan !== Plan.FREE,
    };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.getOrThrow('STRIPE_WEBHOOK_SECRET'),
      );
    } catch (err) {
      this.logger.warn(`Stripe webhook signature verification failed: ${String(err)}`);
      throw new BadRequestException('Invalid Stripe signature');
    }

    // 2. Idempotency: Stripe retries webhooks; don't process twice
    const existing = await this.prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (existing) {
      this.logger.debug(`Stripe event ${event.id} already processed - skipping`);
      return { received: true };
    }

    // 3. Distributed lock — prevents two server instances processing the same event concurrently
    const lockKey = `stripe:lock:${event.id}`;
    const lockToken = await this.redis.acquireLock(lockKey, 30);
    if (!lockToken) {
      this.logger.debug(`Stripe event ${event.id} is being processed by another instance`);
      return { received: true };
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object);
          break;
        default:
          // Log unhandled events so you know what Stripe is sending
          this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
      }

      // 4. Mark as processed — prevents future duplicates
      await this.prisma.stripeEvent.create({
        data: { id: event.id, type: event.type },
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to process Stripe event ${event.id} (${event.type})`,
        err instanceof Error ? err : undefined,
      );
      // Re-throw so Stripe sees a 500 and retries
      throw err;
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    // checkout.session.completed fires when payment is confirmed
    // The subscription is not yet active at this point so we wait for
    // customer.subscription.updated with status: 'active' instead.
    // This handler just stores the subscription ID for future lookups
    if (!session.subscription || !session.metadata?.orgId) return;

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id;

    await this.prisma.organization.update({
      where: { id: session.metadata.orgId },
      data: { stripeSubscriptionId: subscriptionId },
    });

    this.logger.log(`Checkout completed for org ${session.metadata.orgId}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) {
      this.logger.warn(`subscription.updated missing orgId metadata: ${subscription.id}`);
      return;
    }

    const priceId = subscription.items.data[0]?.price.id;
    const plan = (priceId ? this.planMap[priceId] : undefined) ?? Plan.FREE;
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';

    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        plan: isActive ? plan : Plan.FREE,
        stripeSubscriptionId: subscription.id,
        stripeCurrentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
      },
      select: { id: true, plan: true },
    });

    this.activity.log({
      action: 'org.subscription.updated',
      entityType: 'Organization',
      entityId: orgId,
      actorId: 'system',
      orgId,
      metadata: { plan: org.plan, status: subscription.status },
    });

    this.logger.log(`Subscription updated for org ${orgId}: plan=${org.plan}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) return;

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        plan: Plan.FREE,
        stripeSubscriptionId: null,
        stripeCurrentPeriodEnd: null,
      },
    });

    this.activity.log({
      action: 'org.subscription.cancelled',
      entityType: 'Organization',
      entityId: orgId,
      actorId: 'system',
      orgId,
    });

    this.logger.log(`Subscription cancelled for org ${orgId} — downgraded to FREE`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    // invoice.payment_failed fires before Stripe cancels the subscription
    // Log it; Stripe will retry and eventually fire subscription.deleted
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

    if (!customerId) return;

    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });

    if (!org) return;

    this.activity.log({
      action: 'org.payment.failed',
      entityType: 'Organization',
      entityId: org.id,
      actorId: 'system',
      orgId: org.id,
      metadata: { attemptCount: invoice.attempt_count },
    });

    this.logger.warn(`Payment failed for org ${org.id}, attempt ${invoice.attempt_count}`);
    // TODO: enqueue a payment-failed notification email to the org owner
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const subDetails = invoice.parent?.subscription_details;
    const subscriptionId =
      typeof subDetails?.subscription === 'string'
        ? subDetails.subscription
        : subDetails?.subscription?.id;

    if (!subscriptionId) return;

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const orgId = subscription.metadata?.orgId;
    if (!orgId) return;

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        stripeCurrentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
      },
    });
  }

  private async getOrCreateCustomer(
    orgId: string,
    org: { name: string; stripeCustomerId: string | null },
  ): Promise<string> {
    if (org.stripeCustomerId) return org.stripeCustomerId;

    const lockKey = `stripe:customer:${orgId}`;
    const locked = await this.redis.acquireLock(lockKey, 15);
    if (!locked) throw new InternalServerErrorException('Could not acquire customer creation lock');

    try {
      // Re-read inside lock — another request may have created it while we waited
      const fresh = await this.prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { stripeCustomerId: true },
      });
      if (fresh.stripeCustomerId) return fresh.stripeCustomerId;

      const customer = await this.stripe.customers.create({ name: org.name, metadata: { orgId } });
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customer.id },
      });
      return customer.id;
    } finally {
      await this.redis.releaseLock(lockKey, locked);
    }
  }
}
