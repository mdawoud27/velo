import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ResendEmailDto {
  @IsNotEmpty()
  @IsEmail()
  @IsString()
  email: string;
}
