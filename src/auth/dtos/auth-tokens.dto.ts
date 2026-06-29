import { IsString } from 'class-validator';

export class AuthTokensDto {
  @IsString()
  accessToken: string;

  @IsString()
  refreshToken: string;
}
