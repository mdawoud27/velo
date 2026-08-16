import { RealtimeEvictionQueueService } from './realtime-eviction-queue.service';
import { RealtimeEvictionJobType, EVICTION_JOB_OPTIONS } from '../constants/constants';

function makeQueue() {
  return { add: jest.fn().mockResolvedValue({ id: 'job-1' }) } as any;
}

describe('RealtimeEvictionQueueService', () => {
  let service: RealtimeEvictionQueueService;
  let queue: ReturnType<typeof makeQueue>;

  beforeEach(() => {
    queue = makeQueue();
    service = new RealtimeEvictionQueueService(queue);
  });

  it('enqueueEviction adds an EVICT_FROM_ROOM job with correct payload', async () => {
    const payload = { userId: 'u-1', room: 'project:p-1', reason: 'Removed from project' };

    await service.enqueueEviction(payload as any);

    expect(queue.add).toHaveBeenCalledWith(
      RealtimeEvictionJobType.EVICT_FROM_ROOM,
      payload,
      EVICTION_JOB_OPTIONS,
    );
  });

  it('returns the job from the queue', async () => {
    const fakeJob = { id: 'evict-42' };
    queue.add.mockResolvedValueOnce(fakeJob);

    const result = await service.enqueueEviction({
      userId: 'u-2',
      room: 'org:o-1',
      reason: 'Banned',
    } as any);

    expect(result).toBe(fakeJob);
  });
});
