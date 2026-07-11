import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { CACHE_INDEX_PREFIX } from './constants';
import { CacheTags } from './cache.tags';

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

    const members = await this.redis.smembers(indexKey);

    if (members.length === 0) {
      await this.redis.del(indexKey);
      return;
    }

    try {
      await this.redis.del(...members, indexKey);
    } catch (err) {
      this.logger.error(`Failed to invalidate tag ${tag}`, err);
      throw err;
    }
  }
}
