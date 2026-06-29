import { IsBoolean, IsOptional } from 'class-validator';
import type { NotifPreferences } from '../types';

export class NotifPreferencesDto implements NotifPreferences {
  @IsOptional()
  @IsBoolean()
  emailOnTaskAssigned?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnMention?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnDueReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnComment?: boolean;
}
