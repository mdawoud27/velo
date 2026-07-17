import { IsUUID } from 'class-validator';

export class JoinTeamDto {
  @IsUUID()
  teamId: string;
}
