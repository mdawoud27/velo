import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BanUserDto {
  @ApiPropertyOptional({ example: 'Violated terms of service' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
