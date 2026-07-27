export interface AssignableTask {
  id: string;
  title: string;
  assignee: {
    email: string;
    name: string;
    notifPreferences: unknown;
  } | null;
}
