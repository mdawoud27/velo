import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { NotifPreferencesDto } from './notif-preferences.dto';

export class UpdateAccountDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotifPreferencesDto)
  notifPreferences?: NotifPreferencesDto;
}
