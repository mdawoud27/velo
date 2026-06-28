import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ResendEmailDto {
  @ApiProperty({ example: 'dawoud@example.com', description: 'User email' })
  @IsNotEmpty()
  @IsEmail()
  @IsString()
  email: string;
}
