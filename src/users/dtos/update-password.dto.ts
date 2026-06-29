import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*$/;
const STRONG_PASSWORD_MESSAGE =
  'Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol';

export class UpdatePasswordDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(STRONG_PASSWORD_REGEX, {
    message: STRONG_PASSWORD_MESSAGE,
  })
  newPassword: string;
}
