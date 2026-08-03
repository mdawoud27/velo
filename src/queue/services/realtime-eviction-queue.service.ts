import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  EVICTION_JOB_OPTIONS,
  REALTIME_EVICTION_QUEUE,
  RealtimeEvictionJobType,
} from '../constants';
import { EvictFromRoomPayload } from '../interfaces';

@Injectable()
export class RealtimeEvictionQueueService {
  constructor(@InjectQueue(REALTIME_EVICTION_QUEUE) private readonly queue: Queue) {}

  enqueueEviction(payload: EvictFromRoomPayload) {
    return this.queue.add(RealtimeEvictionJobType.EVICT_FROM_ROOM, payload, EVICTION_JOB_OPTIONS);
  }
}
