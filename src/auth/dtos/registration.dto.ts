import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegistrationDto {
  @ApiProperty({
    example: 'Mohamed Dawoud',
    description: 'User full name',
    minLength: 3,
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @MinLength(3)
  name: string;

  @ApiProperty({
    example: 'dawoud@example.com',
    description: 'User email',
    maxLength: 254,
  })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254)
  email: string;

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
  password: string;
}
