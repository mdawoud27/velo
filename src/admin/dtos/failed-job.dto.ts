import { ApiProperty } from '@nestjs/swagger';

export class FailedJobDto {
  @ApiProperty({ example: '42' }) id: string;
  @ApiProperty({ example: 'welcome' }) name: string;
  @ApiProperty({ example: { to: 'user@example.com' } }) data: unknown;
  @ApiProperty({ example: 'connect ECONNREFUSED 127.0.0.1:1025' }) failedReason: string;
  @ApiProperty({ example: 3 }) attemptsMade: number;
  @ApiProperty() timestamp: number;
}
