export type Person = {
  id: string;
  name: string;
};

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  createdBy: string;
  assignedTo: string | null;
  dueAt: number | null;
};

export type Filter = 'all' | 'active' | 'done';
