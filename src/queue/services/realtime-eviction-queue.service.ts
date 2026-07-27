import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { REALTIME_EVICTION_QUEUE, RealtimeEvictionJobType } from '../constants';

export interface EvictFromRoomPayload {
  userId: string;
  room: string;
  reason: string;
}

const EVICTION_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

@Injectable()
export class RealtimeEvictionQueueService {
  constructor(@InjectQueue(REALTIME_EVICTION_QUEUE) private readonly queue: Queue) {}

  enqueueEviction(payload: EvictFromRoomPayload) {
    return this.queue.add(RealtimeEvictionJobType.EVICT_FROM_ROOM, payload, EVICTION_JOB_OPTIONS);
  }
}
