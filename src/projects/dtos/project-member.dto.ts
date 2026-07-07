import { IsNotEmpty, IsUUID } from 'class-validator';

export class ProjectMemberDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
