export const CacheTags = {
  user: (id: string) => `user:${id}`,
  org: (id: string) => `org:${id}`,
  team: (id: string) => `team:${id}`,
  project: (id: string) => `project:${id}`,
  task: (id: string) => `task:${id}`,
};
