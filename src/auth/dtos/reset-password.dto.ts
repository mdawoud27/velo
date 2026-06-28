import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPassword {
  @ApiProperty({ example: 'token', description: 'Reset token' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({
    example: 'P@ssw0rd123',
    description:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol',
    minLength: 8,
    maxLength: 128,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol',
  })
  newPassword: string;
}
