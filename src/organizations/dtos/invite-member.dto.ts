import { OrgRole } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InviteDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsEnum(OrgRole)
  role?: OrgRole;
}
