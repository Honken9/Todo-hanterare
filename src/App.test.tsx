import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./lib/supabase', () => {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi
          .fn()
          .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signOut: vi.fn(),
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
    ProfileRow: {},
    TodoRow: {},
  };
});

import App from './App';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<App /> auth gate', () => {
  it('renders the magic link login when not authenticated', async () => {
    render(<App />);
    expect(
      await screen.findByRole('button', { name: /Skicka länk/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-postadress')).toBeInTheDocument();
  });
});
