import { IsBoolean, IsOptional } from 'class-validator';
import type { NotifPreferences } from '../types';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class NotifPreferencesDto implements NotifPreferences {
  @ApiPropertyOptional({
    example: true,
    description: 'Email on task assigned',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  emailOnTaskAssigned?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Email on mention',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  emailOnMention?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Email on due reminder',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  emailOnDueReminder?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Email on comment',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  emailOnComment?: boolean;
}
