import { IsUUID } from 'class-validator';

export class JoinOrgDto {
  @IsUUID()
  orgId: string;
}
