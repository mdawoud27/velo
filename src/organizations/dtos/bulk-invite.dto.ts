import { ApiProperty } from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsOptional } from 'class-validator';

export class BulkInviteDto {
  @ApiProperty({ example: ['user1@example.com', 'user2@example.com'], isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  emails: string[];

  @ApiProperty({ enum: OrgRole, default: OrgRole.MEMBER, required: false })
  @IsOptional()
  @IsEnum(OrgRole)
  role?: OrgRole;
}
