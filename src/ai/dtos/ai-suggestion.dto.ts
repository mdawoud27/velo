import { ApiProperty } from '@nestjs/swagger';

export class SubtaskDto {
  @ApiProperty({ example: 'Develop user authentication module' })
  title: string;

  @ApiProperty({ example: 'Implement JWT-based authentication with refresh tokens' })
  description: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  priority: string;

  @ApiProperty({ example: 5 })
  estimatedHours: number;
}

export class AiSuggestionDto {
  @ApiProperty({ type: [SubtaskDto] })
  subtasks: SubtaskDto[];

  @ApiProperty({ example: 'Completed user authentication module with JWT and refresh tokens' })
  summary: string;

  @ApiProperty({ example: ['auth', 'jwt', 'security'] }) tags: string[];
}
