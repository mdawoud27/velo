import { ApiProperty } from '@nestjs/swagger';

export class CheckoutResponseDto {
  @ApiProperty({ example: 'https://checkout.stripe.com/pay/cs_test_...' })
  url: string;
}
