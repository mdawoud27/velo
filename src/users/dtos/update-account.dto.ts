import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { NotifPreferencesDto } from './notif-preferences.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAccountDto {
  @ApiPropertyOptional({
    example: 'Mohamed Dawoud',
    description: 'Name of the user',
    type: String,
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    description: 'Notification preferences',
    type: NotifPreferencesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotifPreferencesDto)
  notifPreferences?: NotifPreferencesDto;
}
