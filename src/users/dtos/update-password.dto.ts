import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_REGEX } from '../constants';

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
