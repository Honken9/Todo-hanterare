import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Filter, Profile, Todo } from './types';
import { supabase } from './lib/supabase';
import {
  deleteProfile,
  deleteTodo,
  fetchMyProfile,
  fetchProfiles,
  fetchTodos,
  insertTodo,
  subscribeChanges,
  updateProfile,
  updateTodo,
} from './api';
import { findProfile, profileLabel } from './profiles';
import { applyFilter, cloneAsActive } from './todos';
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
  return <Workspace session={session} />;
}

function Workspace({ session }: { session: Session }) {
  const userId = session.user.id;
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [draftDue, setDraftDue] = useState('');
  const [draftAssignee, setDraftAssignee] = useState('');

  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const reloadProfiles = useCallback(async () => {
    try {
      setProfiles(await fetchProfiles());
      setMe(await fetchMyProfile(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [userId]);

  const reloadTodos = useCallback(async () => {
    try {
      setTodos(await fetchTodos());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void Promise.all([reloadProfiles(), reloadTodos()]).finally(() =>
      setLoading(false),
    );
    const sub = subscribeChanges({
      onProfilesChange: () => void reloadProfiles(),
      onTodosChange: () => void reloadTodos(),
    });
    return () => sub.unsubscribe();
  }, [reloadProfiles, reloadTodos]);

  useEffect(() => {
    if (me) setNameDraft(me.displayName);
  }, [me]);

  const visible = useMemo(() => applyFilter(todos, filter), [todos, filter]);
  const remaining = useMemo(
    () => todos.filter((t) => !t.done && t.archivedAt === null).length,
    [todos],
  );
  const doneCount = useMemo(
    () => todos.filter((t) => t.done && t.archivedAt === null).length,
    [todos],
  );

  async function handleAddTodo(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !me) return;
    setDraft('');
    setDraftDue('');
    setDraftAssignee('');
    try {
      const todo = await insertTodo({
        text: trimmed,
        createdBy: me.id,
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

  async function handleTake(t: Todo) {
    if (!me) return;
    void patchTodo(t.id, { assignedTo: me.id }, (cur) => ({
      ...cur,
      assignedTo: me.id,
    }));
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
      await Promise.all(ids.map((id) => updateTodo(id, { archivedAt: at })));
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
    if (!me) return;
    setFilter('all');
    try {
      const clone = cloneAsActive(source, me.id);
      const todo = await insertTodo({
        text: clone.text,
        createdBy: me.id,
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

  async function handleSaveDisplayName() {
    if (!me) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === me.displayName) return;
    try {
      await updateProfile(me.id, { displayName: trimmed });
      void reloadProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleToggleAdmin(profile: Profile) {
    try {
      await updateProfile(profile.id, { isAdmin: !profile.isAdmin });
      void reloadProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteProfile(profile: Profile) {
    if (!confirm(`Ta bort ${profileLabel(profile)}? Detta går inte att ångra.`)) {
      return;
    }
    try {
      await deleteProfile(profile.id);
      void reloadProfiles();
      void reloadTodos();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const canAddTodo = !!me && draft.trim().length > 0;
  const now = Date.now();
  const isArchiveView = filter === 'archive';

  if (loading || !me) return <main className="app">Laddar…</main>;

  return (
    <main className="app">
      <header className="top-bar">
        <h1>Todo-hanterare</h1>
        <div className="top-bar-actions">
          <span className="who">
            {profileLabel(me)}
            {me.isAdmin && <span className="badge">admin</span>}
          </span>
          {me.isAdmin && (
            <button
              className="ghost"
              onClick={() => setShowAdmin((v) => !v)}
              aria-pressed={showAdmin}
            >
              {showAdmin ? 'Stäng admin' : 'Admin'}
            </button>
          )}
          <button className="ghost" onClick={() => void supabase.auth.signOut()}>
            Logga ut
          </button>
        </div>
      </header>

      {error && (
        <p className="auth-error" role="alert">
          {error}{' '}
          <button className="ghost" onClick={() => setError(null)}>
            Stäng
          </button>
        </p>
      )}

      <section className="profile-edit">
        <h2>Ditt namn</h2>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSaveDisplayName();
          }}
        >
          <input
            aria-label="Visningsnamn"
            placeholder="Hur du visas i listan"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
          <button
            type="submit"
            disabled={
              !nameDraft.trim() || nameDraft.trim() === me.displayName
            }
          >
            Spara
          </button>
        </form>
      </section>

      {showAdmin && me.isAdmin && (
        <section className="admin">
          <h2>Användare (admin)</h2>
          <p className="hint">
            Bjud in nya användare via Supabase: <em>Authentication → Users → Invite user</em>.
          </p>
          <ul className="profile-list">
            {profiles.map((p) => (
              <li key={p.id} className={p.id === me.id ? 'me' : ''}>
                <span className="name">
                  {profileLabel(p)}
                  {p.isAdmin && <span className="badge">admin</span>}
                  {p.id === me.id && <span className="hint">(du)</span>}
                </span>
                <div className="row-actions">
                  <button
                    className="ghost"
                    onClick={() => void handleToggleAdmin(p)}
                    disabled={p.id === me.id}
                    aria-label={
                      p.isAdmin
                        ? `Ta bort admin från ${profileLabel(p)}`
                        : `Gör ${profileLabel(p)} till admin`
                    }
                  >
                    {p.isAdmin ? 'Avmarkera admin' : 'Gör till admin'}
                  </button>
                  <button
                    className="remove"
                    onClick={() => void handleDeleteProfile(p)}
                    disabled={p.id === me.id}
                    aria-label={`Ta bort ${profileLabel(p)}`}
                  >
                    Ta bort
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="todos">
        <h2>Uppgifter</h2>
        <form className="todo-composer" onSubmit={handleAddTodo}>
          <div className="composer-grid">
            <label className="col">
              <span className="col-header">Uppgift</span>
              <input
                placeholder="Vad behöver göras?"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <label className="col">
              <span className="col-header">Klart</span>
              <input
                type="datetime-local"
                value={draftDue}
                onChange={(e) => setDraftDue(e.target.value)}
              />
            </label>
            <label className="col">
              <span className="col-header">Av vem</span>
              <select
                value={draftAssignee}
                onChange={(e) => setDraftAssignee(e.target.value)}
              >
                <option value="">Till alla</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {profileLabel(p)}
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
              const creator = findProfile(profiles, t.createdBy);
              const assignee = findProfile(profiles, t.assignedTo);
              const archived = t.archivedAt !== null;
              const overdue =
                !archived && t.dueAt !== null && !t.done && t.dueAt < now;
              const isOpen = !archived && t.assignedTo === null;
              const canEdit =
                !archived &&
                (me.isAdmin ||
                  t.createdBy === me.id ||
                  t.assignedTo === me.id);
              return (
                <li
                  key={t.id}
                  className={`${t.done ? 'done' : ''} ${overdue ? 'overdue' : ''} ${archived ? 'archived' : ''} ${isOpen ? 'open' : ''}`
                    .trim()
                    .replace(/\s+/g, ' ')}
                >
                  <div className="row">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={t.done}
                        disabled={archived || !canEdit}
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
                          onDoubleClick={() => canEdit && startEdit(t.id, t.text)}
                        >
                          {t.text}
                        </span>
                      )}
                    </label>
                    <div className="row-actions">
                      {archived ? (
                        <>
                          <button
                            aria-label={`Använd igen ${t.text}`}
                            onClick={() => void handleReuse(t)}
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
                          {(me.isAdmin || t.createdBy === me.id) && (
                            <button
                              aria-label={`Ta bort ${t.text}`}
                              className="remove"
                              onClick={() => void handleRemoveTodo(t.id)}
                            >
                              ×
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {isOpen && t.createdBy !== me.id && (
                            <button
                              aria-label={`Ta ${t.text}`}
                              onClick={() => void handleTake(t)}
                            >
                              Ta
                            </button>
                          )}
                          {(me.isAdmin || t.createdBy === me.id) && (
                            <button
                              aria-label={`Ta bort ${t.text}`}
                              className="remove"
                              onClick={() => void handleRemoveTodo(t.id)}
                            >
                              ×
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="meta">
                    <span className="creator">
                      Av: {profileLabel(creator)}
                    </span>
                    {archived ? (
                      <>
                        <span className="archived-at">
                          Arkiverat:{' '}
                          {dueFormatter.format(new Date(t.archivedAt!))}
                        </span>
                        {assignee && (
                          <span>Ansvarig: {profileLabel(assignee)}</span>
                        )}
                      </>
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
                            disabled={!canEdit && !isOpen}
                          >
                            <option value="">Till alla</option>
                            {profiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {profileLabel(p)}
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
                            disabled={!canEdit}
                          />
                        </label>
                        {t.dueAt !== null && (
                          <span className="due-display">
                            ({dueFormatter.format(new Date(t.dueAt))})
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="footer">
          <span>{remaining} kvar</span>
          <button
            onClick={() => void handleArchiveDone()}
            disabled={doneCount === 0}
          >
            Arkivera klara
          </button>
        </footer>
      </section>
    </main>
  );
}
