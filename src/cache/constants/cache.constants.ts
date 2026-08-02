export const CACHE_TTL_KEY = 'cache:ttl';
export const CACHE_TAGS_KEY = 'cache:tags';
export const CACHE_INDEX_PREFIX = 'cache:idx';
export const CacheTags = {
  user: (id: string) => `user:${id}`,
  org: (id: string) => `org:${id}`,
  team: (id: string) => `team:${id}`,
  project: (id: string) => `project:${id}`,
  task: (id: string) => `task:${id}`,
};
