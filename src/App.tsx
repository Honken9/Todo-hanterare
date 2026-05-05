import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Filter, Profile, Todo } from './types';
import { supabase } from './lib/supabase';
import {
  changePassword,
  deleteProfile,
  deleteTodo,
  fetchMyProfile,
  fetchProfiles,
  fetchTodos,
  insertTodo,
  inviteUser,
  subscribeChanges,
  updateProfile,
  updateTodo,
} from './api';
import { findProfile, profileLabel } from './profiles';
import { applyFilter, cloneAsActive } from './todos';
import Auth from './Auth';
import SetPassword, { type SetPasswordReason } from './SetPassword';

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

function detectHashReason(): SetPasswordReason | null {
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.slice(1));
  const type = params.get('type');
  if (type === 'invite') return 'invite';
  if (type === 'recovery') return 'recovery';
  return null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [setPwdReason, setSetPwdReason] = useState<SetPasswordReason | null>(
    () => detectHashReason(),
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'PASSWORD_RECOVERY') {
          setSetPwdReason('recovery');
        }
        setSession(newSession);
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (authLoading) return <main className="app">Laddar…</main>;
  if (!session) return <Auth />;
  if (setPwdReason)
    return (
      <SetPassword reason={setPwdReason} onDone={() => setSetPwdReason(null)} />
    );
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
  const [pwdDraft, setPwdDraft] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdStatus, setPwdStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<
    'idle' | 'sending' | 'sent'
  >('idle');

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwdDraft.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken.');
      return;
    }
    if (pwdDraft !== pwdConfirm) {
      setError('Lösenorden matchar inte.');
      return;
    }
    setPwdStatus('saving');
    try {
      await changePassword(pwdDraft);
      setPwdDraft('');
      setPwdConfirm('');
      setPwdStatus('saved');
      setTimeout(() => setPwdStatus('idle'), 3000);
    } catch (err) {
      setPwdStatus('idle');
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteStatus('sending');
    try {
      await inviteUser(email);
      setInviteEmail('');
      setInviteStatus('sent');
      setTimeout(() => setInviteStatus('idle'), 4000);
      void reloadProfiles();
    } catch (err) {
      setInviteStatus('idle');
      setError(err instanceof Error ? err.message : String(err));
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
        <h2>Mitt konto</h2>
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
            Spara namn
          </button>
        </form>
        <details className="password-change">
          <summary>Byt lösenord</summary>
          <form className="auth-form" onSubmit={(e) => void handleChangePassword(e)}>
            <label className="col">
              <span className="col-header">Nytt lösenord</span>
              <input
                type="password"
                value={pwdDraft}
                onChange={(e) => setPwdDraft(e.target.value)}
                minLength={8}
                disabled={pwdStatus === 'saving'}
              />
            </label>
            <label className="col">
              <span className="col-header">Bekräfta</span>
              <input
                type="password"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                disabled={pwdStatus === 'saving'}
              />
            </label>
            <button
              type="submit"
              disabled={
                !pwdDraft || !pwdConfirm || pwdStatus === 'saving'
              }
            >
              {pwdStatus === 'saving' ? 'Sparar…' : 'Byt lösenord'}
            </button>
          </form>
          {pwdStatus === 'saved' && (
            <p className="auth-success">Lösenordet uppdaterat.</p>
          )}
        </details>
      </section>

      {showAdmin && me.isAdmin && (
        <section className="admin">
          <h2>Användare (admin)</h2>
          <form
            className="composer"
            onSubmit={(e) => void handleInvite(e)}
          >
            <input
              type="email"
              aria-label="Bjud in via e-post"
              placeholder="namn@exempel.se"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviteStatus === 'sending'}
            />
            <button
              type="submit"
              disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
            >
              {inviteStatus === 'sending' ? 'Skickar…' : 'Bjud in'}
            </button>
          </form>
          {inviteStatus === 'sent' && (
            <p className="auth-success">
              Inbjudan skickad. Personen får ett mejl med länk för att sätta lösenord.
            </p>
          )}
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
                              className="take"
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
