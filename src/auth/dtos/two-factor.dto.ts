import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class Enable2FaDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP token' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;
}

export class Disable2FaDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP token' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;
}

export class Verify2FaDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP token or backup code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  token: string;

  @ApiProperty({ example: 'challenge-token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  challengeToken: string;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP' })
  secret: string;

  @ApiProperty({ example: 'data:image/png;base64,...' })
  qrCodeUrl: string;
}
