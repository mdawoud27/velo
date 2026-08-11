import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { STRIPE_CLIENT } from './constants';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: STRIPE_CLIENT,
      useFactory: (config: ConfigService): Stripe =>
        new Stripe(config.getOrThrow('STRIPE_SECRET_KEY'), {
          apiVersion: '2026-07-29.dahlia',
          typescript: true,
        }),
      inject: [ConfigService],
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
