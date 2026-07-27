import { ApiProperty } from '@nestjs/swagger';

export class JobStatusDto {
  @ApiProperty()
  jobId: string;

  @ApiProperty({ enum: ['waiting', 'active', 'completed', 'failed', 'delayed'] })
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progress: number;

  @ApiProperty({ nullable: true, type: String })
  downloadUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  filename: string | null;

  @ApiProperty({ nullable: true, type: Number })
  rowCount: number | null;

  @ApiProperty({ nullable: true, type: String })
  failedReason: string | null;
}
