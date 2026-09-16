import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegistrationDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @MinLength(3)
  name: string;

  @Transform(({ value }: { value: unknown }): unknown => {
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254)
  email: string;

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
