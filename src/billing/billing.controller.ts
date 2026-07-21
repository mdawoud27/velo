import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { Public, CurrentUser } from 'src/auth/decorators';
import { ApiDataResponse, ApiErrorResponses, ResponseMessage } from 'src/common/decorators';
import { CreateCheckoutDto, CheckoutResponseDto, SubscriptionStatusDto } from './dtos';
import type { JwtPayload } from 'src/auth/interfaces';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  @ApiBearerAuth()
  @ResponseMessage('Checkout session created')
  @ApiOperation({ summary: 'Create a Stripe Checkout session for plan upgrade' })
  @ApiDataResponse(CheckoutResponseDto, 'Returns the Stripe hosted checkout URL')
  @ApiErrorResponses(400, 401, 403)
  createCheckout(@Body() dto: CreateCheckoutDto, @CurrentUser() user: JwtPayload) {
    return this.billingService.createCheckoutSession(user.orgId!, dto.plan);
  }

  @Post('portal')
  @ApiBearerAuth()
  @ResponseMessage('Billing portal session created')
  @ApiOperation({ summary: 'Open the Stripe billing portal to manage subscription' })
  @ApiDataResponse(CheckoutResponseDto, 'Returns the Stripe portal URL')
  @ApiErrorResponses(400, 401, 403)
  createPortal(@CurrentUser() user: JwtPayload) {
    return this.billingService.createPortalSession(user.orgId!);
  }

  @Get('subscription')
  @ApiBearerAuth()
  @ResponseMessage('Subscription retrieved')
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiDataResponse(SubscriptionStatusDto)
  @ApiErrorResponses(401, 403, 404)
  getSubscription(@CurrentUser() user: JwtPayload) {
    return this.billingService.getSubscriptionStatus(user.orgId!);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint (internal)' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.billingService.handleStripeWebhook(req.rawBody!, signature);
  }
}
