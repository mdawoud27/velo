import { IsUUID } from 'class-validator';

export class JoinProjectDto {
  @IsUUID()
  projectId: string;
}
