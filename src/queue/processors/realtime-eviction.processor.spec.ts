import { RealtimeEvictionProcessor } from './realtime-eviction.processor';

function makeGateway() {
  return { evictFromRoom: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeLogger() {
  return { error: jest.fn() } as any;
}

describe('RealtimeEvictionProcessor', () => {
  let processor: RealtimeEvictionProcessor;
  let gateway: ReturnType<typeof makeGateway>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    gateway = makeGateway();
    logger = makeLogger();
    processor = new RealtimeEvictionProcessor(gateway, logger);
  });

  it('process calls gateway.evictFromRoom with job payload', async () => {
    const job = {
      data: { userId: 'u-1', room: 'project:p-1', reason: 'Removed from project' },
    } as any;

    await processor.process(job);

    expect(gateway.evictFromRoom).toHaveBeenCalledWith(
      'u-1',
      'project:p-1',
      'Removed from project',
    );
  });

  it('onFailed logs error details', () => {
    const job = {
      data: { userId: 'u-1', room: 'project:p-1' },
    } as any;
    const err = new Error('Socket disconnect timeout');

    processor.onFailed(job, err);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Eviction permanently failed for user u-1 in room project:p-1'),
      err,
      'RealtimeEvictionProcessor',
    );
  });
});
