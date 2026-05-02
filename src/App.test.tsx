import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

describe('<App />', () => {
  it('adds, toggles and removes a todo', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Ny uppgift'), 'köp mjölk');
    await user.click(screen.getByRole('button', { name: 'Lägg till' }));

    expect(screen.getByText('köp mjölk')).toBeInTheDocument();
    expect(screen.getByText('1 kvar')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByText('0 kvar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ta bort köp mjölk/ }));
    expect(screen.queryByText('köp mjölk')).not.toBeInTheDocument();
  });

  it('filters todos', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText('Ny uppgift');
    await user.type(input, 'a');
    await user.click(screen.getByRole('button', { name: 'Lägg till' }));
    await user.type(input, 'b');
    await user.click(screen.getByRole('button', { name: 'Lägg till' }));

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    await user.click(screen.getByRole('tab', { name: 'Klara' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: 'Aktiva' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
