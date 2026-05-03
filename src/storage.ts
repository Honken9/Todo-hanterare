const ME_KEY = 'todo-hanterare:me:v1';

export function loadMe(): string | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMe(id: string | null): void {
  if (id === null) {
    localStorage.removeItem(ME_KEY);
    return;
  }
  localStorage.setItem(ME_KEY, JSON.stringify(id));
}
