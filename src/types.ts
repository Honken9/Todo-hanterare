export type Profile = {
  id: string;
  displayName: string;
  isAdmin: boolean;
};

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  createdBy: string | null;
  assignedTo: string | null;
  dueAt: number | null;
  archivedAt: number | null;
};

export type Filter = 'all' | 'active' | 'done' | 'archive';
