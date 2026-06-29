import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeOAuthCodeDto {
  @ApiProperty({
    example: '4/0Adeu5BV...',
    description: 'OAuth authorization code',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
