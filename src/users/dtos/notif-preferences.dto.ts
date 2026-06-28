import { IsBoolean, IsOptional } from 'class-validator';
import type { NotifPreferences } from '../types';
import { ApiProperty } from '@nestjs/swagger';

export class NotifPreferencesDto implements NotifPreferences {
  @ApiProperty({
    example: true,
    description: 'Email on task assigned',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  emailOnTaskAssigned?: boolean;

  @ApiProperty({
    example: true,
    description: 'Email on mention',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  emailOnMention?: boolean;

  @ApiProperty({
    example: true,
    description: 'Email on due reminder',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  emailOnDueReminder?: boolean;

  @ApiProperty({
    example: true,
    description: 'Email on comment',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  emailOnComment?: boolean;
}
