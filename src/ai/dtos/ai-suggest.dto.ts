import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { AiSuggestMode } from '../constants';

export class AiSuggestDto {
  @ApiProperty({
    example: 'Build a user authentication system with JWT and refresh tokens',
    description: 'The context or task description to generate suggestions for',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  context: string;

  @ApiPropertyOptional({ enum: AiSuggestMode, default: AiSuggestMode.TASK_BREAKDOWN })
  @IsOptional()
  @IsEnum(AiSuggestMode)
  mode?: AiSuggestMode = AiSuggestMode.TASK_BREAKDOWN;
}
