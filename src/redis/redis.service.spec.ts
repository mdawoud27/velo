import { RedisService } from './redis.service';

function makeRedisClient() {
  return {
    set: jest.fn(),
    setex: jest.fn(),
    get: jest.fn(),
    getdel: jest.fn(),
    getex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    eval: jest.fn(),
    scan: jest.fn(),
    sadd: jest.fn(),
    smembers: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  } as any;
}

function makeLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  } as any;
}

describe('RedisService', () => {
  let service: RedisService;
  let client: ReturnType<typeof makeRedisClient>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    client = makeRedisClient();
    logger = makeLogger();
    service = new RedisService(client, logger);
  });

  it('onModuleDestroy quits redis client', async () => {
    await service.onModuleDestroy();
    expect(client.quit).toHaveBeenCalled();
  });

  describe('set & setex', () => {
    it('calls client.set', async () => {
      await service.set('k1', 'v1');
      expect(client.set).toHaveBeenCalledWith('k1', 'v1');
    });

    it('calls client.setex with validated TTL', async () => {
      await service.setex('k1', 'v1', 60);
      expect(client.setex).toHaveBeenCalledWith('k1', 60, 'v1');
    });

    it('throws error when TTL is 0 or negative', async () => {
      await expect(service.setex('k1', 'v1', 0)).rejects.toThrow(/Invalid TTL/);
      await expect(service.setex('k1', 'v1', -5)).rejects.toThrow(/Invalid TTL/);
    });
  });

  describe('get, getdel, getex', () => {
    it('get returns value from client', async () => {
      client.get.mockResolvedValueOnce('val');
      expect(await service.get('k1')).toBe('val');
    });

    it('getdel calls client.getdel', async () => {
      client.getdel.mockResolvedValueOnce('val');
      expect(await service.getdel('k1')).toBe('val');
    });

    it('getex validates TTL and calls client.getex', async () => {
      client.getex.mockResolvedValueOnce('val');
      expect(await service.getex('k1', 30)).toBe('val');
      expect(client.getex).toHaveBeenCalledWith('k1', 'EX', 30);
    });
  });

  describe('del', () => {
    it('returns 0 when array of keys is empty', async () => {
      const result = await service.del();
      expect(result).toBe(0);
      expect(client.del).not.toHaveBeenCalled();
    });

    it('calls client.del with provided keys', async () => {
      client.del.mockResolvedValueOnce(2);
      const result = await service.del('k1', 'k2');
      expect(result).toBe(2);
      expect(client.del).toHaveBeenCalledWith('k1', 'k2');
    });
  });

  describe('acquireLock & releaseLock', () => {
    it('acquires lock when client.set returns OK', async () => {
      client.set.mockResolvedValueOnce('OK');
      const token = await service.acquireLock('resource-1', 10);
      expect(token).toBeDefined();
      expect(client.set).toHaveBeenCalledWith(
        'lock:resource-1',
        expect.any(String),
        'EX',
        10,
        'NX',
      );
    });

    it('returns null when lock acquisition fails', async () => {
      client.set.mockResolvedValueOnce(null);
      const token = await service.acquireLock('resource-1', 10);
      expect(token).toBeNull();
    });

    it('releaseLock executes lua script and returns true on success', async () => {
      client.eval.mockResolvedValueOnce(1);
      const released = await service.releaseLock('resource-1', 'token-123');
      expect(released).toBe(true);
      expect(client.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'lock:resource-1',
        'token-123',
      );
    });

    it('releaseLock returns false if token does not match', async () => {
      client.eval.mockResolvedValueOnce(0);
      const released = await service.releaseLock('resource-1', 'wrong-token');
      expect(released).toBe(false);
    });
  });

  describe('getJson & setJson', () => {
    it('getJson returns parsed JSON object', async () => {
      client.get.mockResolvedValueOnce(JSON.stringify({ a: 1 }));
      const obj = await service.getJson<{ a: number }>('k1');
      expect(obj).toEqual({ a: 1 });
    });

    it('getJson returns null if key does not exist', async () => {
      client.get.mockResolvedValueOnce(null);
      expect(await service.getJson('k1')).toBeNull();
    });

    it('setJson serializes value and calls setex', async () => {
      await service.setJson('k1', { b: 2 }, 60);
      expect(client.setex).toHaveBeenCalledWith('k1', 60, JSON.stringify({ b: 2 }));
    });
  });

  describe('deleteByPattern', () => {
    it('scans keys matching pattern and deletes them', async () => {
      client.scan.mockResolvedValueOnce(['10', ['k1', 'k2']]).mockResolvedValueOnce(['0', ['k3']]);

      await service.deleteByPattern('user:*');

      expect(client.scan).toHaveBeenCalledTimes(2);
      expect(client.del).toHaveBeenCalledWith('k1', 'k2');
      expect(client.del).toHaveBeenCalledWith('k3');
    });
  });
});
