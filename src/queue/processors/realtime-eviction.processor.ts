import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RealtimeGateway } from 'src/realtime/realtime.gateway';
import { REALTIME_EVICTION_QUEUE } from '../constants/constants';
import { EvictFromRoomPayload } from '../services';
import { LoggerService } from 'src/logger/logger.service';

@Processor(REALTIME_EVICTION_QUEUE)
export class RealtimeEvictionProcessor extends WorkerHost {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job<EvictFromRoomPayload>): Promise<void> {
    const { userId, room, reason } = job.data;
    await this.gateway.evictFromRoom(userId, room, reason);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EvictFromRoomPayload> | undefined, err: Error) {
    this.logger.error(
      `Eviction permanently failed for user ${job?.data.userId} in room ${job?.data.room}: ${err.message}`,
      err instanceof Error ? err : undefined,
      RealtimeEvictionProcessor.name,
    );
  }
}
