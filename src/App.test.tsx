import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

function peopleSection() {
  return screen.getByRole('heading', { name: 'Personer' })
    .parentElement as HTMLElement;
}

function todosSection() {
  return screen.getByRole('heading', { name: 'Uppgifter' })
    .parentElement as HTMLElement;
}

async function addPerson(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.type(screen.getByLabelText('Nytt namn'), name);
  await user.click(
    within(peopleSection()).getByRole('button', { name: 'Lägg till' }),
  );
}

async function addTodo(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  await user.type(screen.getByLabelText('Uppgift'), text);
  await user.click(
    within(todosSection()).getByRole('button', { name: 'Lägg till' }),
  );
}

describe('<App />', () => {
  it('blocks adding todos until a person is selected as me', () => {
    render(<App />);
    expect(screen.getByLabelText('Uppgift')).toBeDisabled();
  });

  it('adds a person, becomes them, and creates a todo with creator', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addPerson(user, 'Anna');
    expect(
      within(peopleSection()).getByRole('button', { name: 'Ta bort Anna' }),
    ).toBeInTheDocument();

    await addTodo(user, 'köp mjölk');

    const todoItem = within(todosSection()).getByRole('listitem');
    expect(within(todoItem).getByText('köp mjölk')).toBeInTheDocument();
    expect(within(todoItem).getByText(/Av:\s*Anna/)).toBeInTheDocument();
  });

  it('removing a person clears their assignments', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addPerson(user, 'Anna');
    await addPerson(user, 'Björn');

    await user.type(screen.getByLabelText('Uppgift'), 'fixa lampan');
    await user.selectOptions(screen.getByLabelText('Av vem'), 'Björn');
    await user.click(
      within(todosSection()).getByRole('button', { name: 'Lägg till' }),
    );

    const assigneeSelect = screen.getByLabelText(
      'Ansvarig för fixa lampan',
    ) as HTMLSelectElement;
    expect(assigneeSelect.selectedOptions[0].textContent).toBe('Björn');

    await user.click(screen.getByRole('button', { name: 'Ta bort Björn' }));

    expect(
      (screen.getByLabelText('Ansvarig för fixa lampan') as HTMLSelectElement)
        .value,
    ).toBe('');
  });

  it('toggles, filters, and removes a todo', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addPerson(user, 'Anna');
    await addTodo(user, 'a');
    await addTodo(user, 'b');

    const checkboxes = within(todosSection()).getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(screen.getByText('1 kvar')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Klara' }));
    expect(within(todosSection()).getAllByRole('listitem')).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: 'Aktiva' }));
    expect(within(todosSection()).getAllByRole('listitem')).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: 'Alla' }));
    await user.click(screen.getByRole('button', { name: /Ta bort a/ }));
    expect(within(todosSection()).queryByText('a')).not.toBeInTheDocument();
  });

  it('archives done todos and preserves them in arkiv', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addPerson(user, 'Anna');
    await addTodo(user, 'städa köket');
    await addTodo(user, 'fortfarande att göra');

    const doneCheckbox = within(todosSection()).getAllByRole('checkbox')[1];
    await user.click(doneCheckbox);

    await user.click(screen.getByRole('button', { name: 'Arkivera klara' }));

    expect(
      within(todosSection()).queryByText('städa köket'),
    ).not.toBeInTheDocument();
    expect(within(todosSection()).getByText('fortfarande att göra')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Arkiv' }));
    expect(within(todosSection()).getByText('städa köket')).toBeInTheDocument();
    expect(within(todosSection()).getByText(/Arkiverat:/)).toBeInTheDocument();
  });

  it('reuses an archived todo as a new active one', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addPerson(user, 'Anna');
    await addTodo(user, 'vattna blommor');

    await user.click(within(todosSection()).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Arkivera klara' }));
    await user.click(screen.getByRole('tab', { name: 'Arkiv' }));
    await user.click(
      screen.getByRole('button', { name: 'Använd igen vattna blommor' }),
    );

    expect(within(todosSection()).getByText('vattna blommor')).toBeInTheDocument();
    expect(screen.getByText('1 kvar')).toBeInTheDocument();
  });

  it('restores an archived todo to active', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addPerson(user, 'Anna');
    await addTodo(user, 'damma');

    await user.click(within(todosSection()).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Arkivera klara' }));
    await user.click(screen.getByRole('tab', { name: 'Arkiv' }));
    await user.click(screen.getByRole('button', { name: 'Återställ damma' }));

    expect(within(todosSection()).getByText('Arkivet är tomt.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Aktiva' }));
    expect(within(todosSection()).getByText('damma')).toBeInTheDocument();
  });
});
