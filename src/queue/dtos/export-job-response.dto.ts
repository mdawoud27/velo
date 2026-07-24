import { ApiProperty } from '@nestjs/swagger';

export class ExportJobResponseDto {
  @ApiProperty({ description: 'ID of the queued export job, used to poll status' })
  jobId: string;
}
