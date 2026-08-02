import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { CacheTags, CACHE_INDEX_PREFIX } from './constants';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  async invalidateUserCache(userId: string) {
    await this.invalidateTag(CacheTags.user(userId));
  }

  async invalidateOrganizationCache(orgId: string) {
    await this.invalidateTag(CacheTags.org(orgId));
  }

  async invalidateTeamCache(teamId: string) {
    await this.invalidateTag(CacheTags.team(teamId));
  }

  async invalidateProjectCache(projectId: string) {
    await this.invalidateTag(CacheTags.project(projectId));
  }

  async invalidateTaskCache(taskId: string) {
    await this.invalidateTag(CacheTags.task(taskId));
  }

  private async invalidateTag(tag: string): Promise<void> {
    const indexKey = `${CACHE_INDEX_PREFIX}:${tag}`;

    const script = `
    local members = redis.call('smembers', KEYS[1])
    for i, key in ipairs(members) do
      redis.call('del', key)
    end
    redis.call('del', KEYS[1])
    return #members
  `;

    try {
      await this.redis.eval(script, 1, indexKey);
    } catch (err) {
      this.logger.error(`Failed to invalidate tag ${tag}`, err);
      throw err;
    }
  }
}
