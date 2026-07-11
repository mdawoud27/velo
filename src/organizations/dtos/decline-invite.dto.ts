import { IsNotEmpty, IsString } from 'class-validator';

export class DeclineInviteDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
