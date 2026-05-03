import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Filter, Todo } from './types';
import { supabase } from './lib/supabase';
import {
  deletePerson,
  deleteTodo,
  fetchPeople,
  fetchTodos,
  insertPerson,
  insertTodo,
  subscribeChanges,
  updateTodo,
} from './api';
import { findPerson } from './people';
import { applyFilter, cloneAsActive } from './todos';
import { loadMe, saveMe } from './storage';
import Auth from './Auth';

const dueFormatter = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function dueToInputValue(dueAt: number | null): string {
  if (dueAt === null) return '';
  const d = new Date(dueAt);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function inputValueToDue(value: string): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Alla',
  active: 'Aktiva',
  done: 'Klara',
  archive: 'Arkiv',
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (authLoading) return <main className="app">Laddar…</main>;
  if (!session) return <Auth />;
  return <Workspace />;
}

function Workspace() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [people, setPeople] = useState(() => [] as { id: string; name: string }[]);
  const [me, setMe] = useState<string | null>(() => loadMe());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [draftDue, setDraftDue] = useState('');
  const [draftAssignee, setDraftAssignee] = useState('');

  const [filter, setFilter] = useState<Filter>('all');
  const [personDraft, setPersonDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const reloadPeople = useCallback(async () => {
    try {
      setPeople(await fetchPeople());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const reloadTodos = useCallback(async () => {
    try {
      setTodos(await fetchTodos());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void Promise.all([reloadPeople(), reloadTodos()]).finally(() =>
      setLoading(false),
    );
    const sub = subscribeChanges({
      onPeopleChange: () => void reloadPeople(),
      onTodosChange: () => void reloadTodos(),
    });
    return () => sub.unsubscribe();
  }, [reloadPeople, reloadTodos]);

  useEffect(() => {
    saveMe(me);
  }, [me]);

  useEffect(() => {
    if (me !== null && !people.find((p) => p.id === me)) {
      setMe(null);
    }
  }, [me, people]);

  const visible = useMemo(() => applyFilter(todos, filter), [todos, filter]);
  const remaining = useMemo(
    () => todos.filter((t) => !t.done && t.archivedAt === null).length,
    [todos],
  );
  const doneCount = useMemo(
    () => todos.filter((t) => t.done && t.archivedAt === null).length,
    [todos],
  );

  async function handleAddPerson(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = personDraft.trim();
    if (!trimmed) return;
    setPersonDraft('');
    try {
      const person = await insertPerson(trimmed);
      setPeople((prev) => [...prev, person]);
      if (me === null) setMe(person.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRemovePerson(id: string) {
    try {
      await deletePerson(id);
      setPeople((prev) => prev.filter((p) => p.id !== id));
      if (me === id) setMe(null);
      void reloadTodos();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleAddTodo(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || me === null) return;
    setDraft('');
    setDraftDue('');
    setDraftAssignee('');
    try {
      const todo = await insertTodo({
        text: trimmed,
        createdBy: me,
        assignedTo: draftAssignee || null,
        dueAt: inputValueToDue(draftDue),
      });
      setTodos((prev) => [todo, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function patchTodo(
    id: string,
    patch: Parameters<typeof updateTodo>[1],
    optimistic: (t: Todo) => Todo,
  ) {
    setTodos((prev) => prev.map((t) => (t.id === id ? optimistic(t) : t)));
    try {
      await updateTodo(id, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      void reloadTodos();
    }
  }

  async function handleToggle(t: Todo) {
    void patchTodo(t.id, { done: !t.done }, (cur) => ({ ...cur, done: !cur.done }));
  }

  async function handleSetAssignee(id: string, assignedTo: string | null) {
    void patchTodo(id, { assignedTo }, (cur) => ({ ...cur, assignedTo }));
  }

  async function handleSetDueAt(id: string, dueAt: number | null) {
    void patchTodo(id, { dueAt }, (cur) => ({ ...cur, dueAt }));
  }

  async function handleUnarchive(t: Todo) {
    void patchTodo(
      t.id,
      { archivedAt: null, done: false },
      (cur) => ({ ...cur, archivedAt: null, done: false }),
    );
  }

  async function handleArchiveDone() {
    const at = Date.now();
    const ids = todos
      .filter((t) => t.done && t.archivedAt === null)
      .map((t) => t.id);
    setTodos((prev) =>
      prev.map((t) =>
        t.done && t.archivedAt === null ? { ...t, archivedAt: at } : t,
      ),
    );
    try {
      await Promise.all(
        ids.map((id) => updateTodo(id, { archivedAt: at })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      void reloadTodos();
    }
  }

  async function handleRemoveTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTodo(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      void reloadTodos();
    }
  }

  async function handleReuse(source: Todo) {
    if (me === null) return;
    setFilter('all');
    try {
      const clone = cloneAsActive(source, me);
      const todo = await insertTodo({
        text: clone.text,
        createdBy: clone.createdBy,
        assignedTo: clone.assignedTo,
        dueAt: clone.dueAt,
      });
      setTodos((prev) => [todo, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function startEdit(id: string, current: string) {
    setEditingId(id);
    setEditingText(current);
  }

  async function commitEdit() {
    if (editingId === null) return;
    const id = editingId;
    const text = editingText.trim();
    setEditingId(null);
    setEditingText('');
    if (!text) {
      void handleRemoveTodo(id);
      return;
    }
    void patchTodo(id, { text }, (cur) => ({ ...cur, text }));
  }

  const canAddTodo = me !== null && draft.trim().length > 0;
  const now = Date.now();
  const isArchiveView = filter === 'archive';

  if (loading) return <main className="app">Laddar…</main>;

  return (
    <main className="app">
      <header className="top-bar">
        <h1>Todo-hanterare</h1>
        <button
          className="ghost"
          onClick={() => void supabase.auth.signOut()}
          aria-label="Logga ut"
        >
          Logga ut
        </button>
      </header>

      {error && (
        <p className="auth-error" role="alert">
          {error}{' '}
          <button className="ghost" onClick={() => setError(null)}>
            Stäng
          </button>
        </p>
      )}

      <section className="people">
        <h2>Personer</h2>
        <form className="composer" onSubmit={handleAddPerson}>
          <input
            aria-label="Nytt namn"
            placeholder="Lägg till person"
            value={personDraft}
            onChange={(e) => setPersonDraft(e.target.value)}
          />
          <button type="submit" disabled={!personDraft.trim()}>
            Lägg till
          </button>
        </form>
        {people.length > 0 && (
          <ul className="person-list">
            {people.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <button
                  aria-label={`Ta bort ${p.name}`}
                  className="remove"
                  onClick={() => void handleRemovePerson(p.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="me-picker">
          Du är:{' '}
          <select
            aria-label="Du är"
            value={me ?? ''}
            onChange={(e) => setMe(e.target.value || null)}
            disabled={people.length === 0}
          >
            <option value="">— välj —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="todos">
        <h2>Uppgifter</h2>
        <form className="todo-composer" onSubmit={handleAddTodo}>
          <div className="composer-grid">
            <label className="col">
              <span className="col-header">Uppgift</span>
              <input
                placeholder={
                  me === null ? 'Välj vem du är först' : 'Vad behöver göras?'
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={me === null}
              />
            </label>
            <label className="col">
              <span className="col-header">Klart</span>
              <input
                type="datetime-local"
                value={draftDue}
                onChange={(e) => setDraftDue(e.target.value)}
                disabled={me === null}
              />
            </label>
            <label className="col">
              <span className="col-header">Av vem</span>
              <select
                value={draftAssignee}
                onChange={(e) => setDraftAssignee(e.target.value)}
                disabled={me === null || people.length === 0}
              >
                <option value="">Ingen ansvarig</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" disabled={!canAddTodo}>
            Lägg till
          </button>
        </form>

        <div className="filters" role="tablist">
          {(['all', 'active', 'done', 'archive'] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="empty">
            {isArchiveView ? 'Arkivet är tomt.' : 'Inga uppgifter att visa.'}
          </p>
        ) : (
          <ul className="list">
            {visible.map((t) => {
              const creator = findPerson(people, t.createdBy);
              const archived = t.archivedAt !== null;
              const overdue =
                !archived && t.dueAt !== null && !t.done && t.dueAt < now;
              return (
                <li
                  key={t.id}
                  className={`${t.done ? 'done' : ''} ${overdue ? 'overdue' : ''} ${archived ? 'archived' : ''}`
                    .trim()
                    .replace(/\s+/g, ' ')}
                >
                  <div className="row">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={t.done}
                        disabled={archived}
                        onChange={() => void handleToggle(t)}
                      />
                      {editingId === t.id ? (
                        <input
                          aria-label="Redigera uppgift"
                          autoFocus
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => void commitEdit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitEdit();
                            if (e.key === 'Escape') {
                              setEditingId(null);
                              setEditingText('');
                            }
                          }}
                        />
                      ) : (
                        <span
                          onDoubleClick={() =>
                            !archived && startEdit(t.id, t.text)
                          }
                        >
                          {t.text}
                        </span>
                      )}
                    </label>
                    {archived ? (
                      <div className="row-actions">
                        <button
                          aria-label={`Använd igen ${t.text}`}
                          onClick={() => void handleReuse(t)}
                          disabled={me === null}
                        >
                          Använd igen
                        </button>
                        <button
                          aria-label={`Återställ ${t.text}`}
                          className="ghost"
                          onClick={() => void handleUnarchive(t)}
                        >
                          Återställ
                        </button>
                        <button
                          aria-label={`Ta bort ${t.text}`}
                          className="remove"
                          onClick={() => void handleRemoveTodo(t.id)}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        aria-label={`Ta bort ${t.text}`}
                        className="remove"
                        onClick={() => void handleRemoveTodo(t.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="meta">
                    <span className="creator">
                      Av: {creator ? creator.name : '(borttagen)'}
                    </span>
                    {archived ? (
                      <span className="archived-at">
                        Arkiverat:{' '}
                        {dueFormatter.format(new Date(t.archivedAt!))}
                      </span>
                    ) : (
                      <>
                        <label>
                          Ansvarig:{' '}
                          <select
                            aria-label={`Ansvarig för ${t.text}`}
                            value={t.assignedTo ?? ''}
                            onChange={(e) =>
                              void handleSetAssignee(
                                t.id,
                                e.target.value || null,
                              )
                            }
                          >
                            <option value="">— ingen —</option>
                            {people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Senast:{' '}
                          <input
                            aria-label={`Senast för ${t.text}`}
                            type="datetime-local"
                            value={dueToInputValue(t.dueAt)}
                            onChange={(e) =>
                              void handleSetDueAt(
                                t.id,
                                inputValueToDue(e.target.value),
                              )
                            }
                          />
                        </label>
                        {t.dueAt !== null && (
                          <span className="due-display">
                            ({dueFormatter.format(new Date(t.dueAt))})
                          </span>
                        )}
                      </>
                    )}
                    {archived && t.assignedTo !== null && (
                      <span>
                        Ansvarig:{' '}
                        {findPerson(people, t.assignedTo)?.name ??
                          '(borttagen)'}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="footer">
          <span>{remaining} kvar</span>
          <button onClick={() => void handleArchiveDone()} disabled={doneCount === 0}>
            Arkivera klara
          </button>
        </footer>
      </section>
    </main>
  );
}
