import { useEffect, useMemo, useState } from 'react';
import type { Filter } from './types';
import { loadTodos, saveTodos } from './storage';
import {
  applyFilter,
  clearDone,
  createTodo,
  remove,
  rename,
  toggle,
} from './todos';

export default function App() {
  const [todos, setTodos] = useState(() => loadTodos());
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  const visible = useMemo(() => applyFilter(todos, filter), [todos, filter]);
  const remaining = useMemo(() => todos.filter((t) => !t.done).length, [todos]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setTodos((prev) => [createTodo(trimmed), ...prev]);
    setDraft('');
  }

  function startEdit(id: string, current: string) {
    setEditingId(id);
    setEditingText(current);
  }

  function commitEdit() {
    if (editingId === null) return;
    setTodos((prev) => rename(prev, editingId, editingText));
    setEditingId(null);
    setEditingText('');
  }

  return (
    <main className="app">
      <h1>Todo-hanterare</h1>

      <form className="composer" onSubmit={handleAdd}>
        <input
          aria-label="Ny uppgift"
          placeholder="Vad behöver göras?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={!draft.trim()}>
          Lägg till
        </button>
      </form>

      <div className="filters" role="tablist">
        {(['all', 'active', 'done'] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Alla' : f === 'active' ? 'Aktiva' : 'Klara'}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="empty">Inga uppgifter att visa.</p>
      ) : (
        <ul className="list">
          {visible.map((t) => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => setTodos((prev) => toggle(prev, t.id))}
                />
                {editingId === t.id ? (
                  <input
                    aria-label="Redigera uppgift"
                    autoFocus
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditingText('');
                      }
                    }}
                  />
                ) : (
                  <span onDoubleClick={() => startEdit(t.id, t.text)}>
                    {t.text}
                  </span>
                )}
              </label>
              <button
                aria-label={`Ta bort ${t.text}`}
                className="remove"
                onClick={() => setTodos((prev) => remove(prev, t.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="footer">
        <span>{remaining} kvar</span>
        <button
          onClick={() => setTodos((prev) => clearDone(prev))}
          disabled={remaining === todos.length}
        >
          Rensa klara
        </button>
      </footer>
    </main>
  );
}
