import { IsEmail, IsString } from 'class-validator';

export class ResendEmailDto {
  @IsEmail()
  @IsString()
  email: string;
}
