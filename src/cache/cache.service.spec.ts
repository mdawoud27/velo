import { CacheService } from './cache.service';

function makeRedis() {
  return {
    eval: jest.fn().mockResolvedValue(1),
  } as any;
}

describe('CacheService', () => {
  let service: CacheService;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
    service = new CacheService(redis);
  });

  it('invalidateUserCache calls redis.eval with user index key', async () => {
    await service.invalidateUserCache('u-1');
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, 'cache:idx:user:u-1');
  });

  it('invalidateOrganizationCache calls redis.eval with org index key', async () => {
    await service.invalidateOrganizationCache('org-1');
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, 'cache:idx:org:org-1');
  });

  it('invalidateTeamCache calls redis.eval with team index key', async () => {
    await service.invalidateTeamCache('team-1');
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, 'cache:idx:team:team-1');
  });

  it('invalidateProjectCache calls redis.eval with project index key', async () => {
    await service.invalidateProjectCache('proj-1');
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, 'cache:idx:project:proj-1');
  });

  it('invalidateTaskCache calls redis.eval with task index key', async () => {
    await service.invalidateTaskCache('task-1');
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, 'cache:idx:task:task-1');
  });

  it('re-throws error if redis.eval fails', async () => {
    const err = new Error('Lua execution error');
    redis.eval.mockRejectedValueOnce(err);

    await expect(service.invalidateUserCache('u-1')).rejects.toThrow(err);
  });
});
