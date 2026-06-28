import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    example: '34b3d3c6-a4a3-4a3e-8d3d-3d3c3d3c3d3c',
    description: 'Token used to verify email address',
  })
  @IsUUID()
  token: string;
}
