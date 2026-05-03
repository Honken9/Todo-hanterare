import { useEffect, useMemo, useState } from 'react';
import type { Filter } from './types';
import {
  loadMe,
  loadPeople,
  loadTodos,
  saveMe,
  savePeople,
  saveTodos,
} from './storage';
import { createPerson, findPerson, removePerson } from './people';
import {
  applyFilter,
  clearAssignee,
  clearDone,
  createTodo,
  remove,
  rename,
  setAssignee,
  setDueAt,
  toggle,
} from './todos';

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

export default function App() {
  const [todos, setTodos] = useState(() => loadTodos());
  const [people, setPeople] = useState(() => loadPeople());
  const [me, setMe] = useState<string | null>(() => loadMe());

  const [draft, setDraft] = useState('');
  const [draftDue, setDraftDue] = useState('');
  const [draftAssignee, setDraftAssignee] = useState('');

  const [filter, setFilter] = useState<Filter>('all');
  const [personDraft, setPersonDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);
  useEffect(() => {
    savePeople(people);
  }, [people]);
  useEffect(() => {
    saveMe(me);
  }, [me]);

  const visible = useMemo(() => applyFilter(todos, filter), [todos, filter]);
  const remaining = useMemo(() => todos.filter((t) => !t.done).length, [todos]);

  function handleAddPerson(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = personDraft.trim();
    if (!trimmed) return;
    const person = createPerson(trimmed);
    setPeople((prev) => [...prev, person]);
    if (me === null) setMe(person.id);
    setPersonDraft('');
  }

  function handleRemovePerson(id: string) {
    setPeople((prev) => removePerson(prev, id));
    setTodos((prev) => clearAssignee(prev, id));
    if (me === id) setMe(null);
  }

  function handleAddTodo(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || me === null) return;
    setTodos((prev) => [
      createTodo({
        text: trimmed,
        createdBy: me,
        assignedTo: draftAssignee || null,
        dueAt: inputValueToDue(draftDue),
      }),
      ...prev,
    ]);
    setDraft('');
    setDraftDue('');
    setDraftAssignee('');
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

  const canAddTodo = me !== null && draft.trim().length > 0;
  const now = Date.now();

  return (
    <main className="app">
      <h1>Todo-hanterare</h1>

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
                  onClick={() => handleRemovePerson(p.id)}
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
            {visible.map((t) => {
              const creator = findPerson(people, t.createdBy);
              const overdue =
                t.dueAt !== null && !t.done && t.dueAt < now;
              return (
                <li
                  key={t.id}
                  className={`${t.done ? 'done' : ''} ${overdue ? 'overdue' : ''}`.trim()}
                >
                  <div className="row">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() =>
                          setTodos((prev) => toggle(prev, t.id))
                        }
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
                  </div>
                  <div className="meta">
                    <span className="creator">
                      Av: {creator ? creator.name : '(borttagen)'}
                    </span>
                    <label>
                      Ansvarig:{' '}
                      <select
                        aria-label={`Ansvarig för ${t.text}`}
                        value={t.assignedTo ?? ''}
                        onChange={(e) =>
                          setTodos((prev) =>
                            setAssignee(prev, t.id, e.target.value || null),
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
                          setTodos((prev) =>
                            setDueAt(prev, t.id, inputValueToDue(e.target.value)),
                          )
                        }
                      />
                    </label>
                    {t.dueAt !== null && (
                      <span className="due-display">
                        ({dueFormatter.format(new Date(t.dueAt))})
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
          <button
            onClick={() => setTodos((prev) => clearDone(prev))}
            disabled={remaining === todos.length}
          >
            Rensa klara
          </button>
        </footer>
      </section>
    </main>
  );
}
