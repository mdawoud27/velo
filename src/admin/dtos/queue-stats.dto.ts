import { ApiProperty } from '@nestjs/swagger';

class JobCountsDto {
  @ApiProperty() waiting: number;
  @ApiProperty() active: number;
  @ApiProperty() completed: number;
  @ApiProperty() failed: number;
  @ApiProperty() delayed: number;
}

export class QueueStatsDto {
  @ApiProperty({ example: 'email-queue' }) queueName: string;
  @ApiProperty({ type: JobCountsDto }) counts: JobCountsDto;
}
