import { useState } from 'react';
import { supabase } from './lib/supabase';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus('sending');
    setErrorMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('sent');
  }

  return (
    <main className="app auth">
      <h1>Todo-hanterare</h1>
      <p>Logga in med din e-post för att fortsätta. Du får en länk som loggar in dig.</p>
      <form onSubmit={handleSubmit} className="composer">
        <input
          type="email"
          aria-label="E-postadress"
          placeholder="namn@exempel.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          disabled={status === 'sending' || status === 'sent'}
        />
        <button
          type="submit"
          disabled={!email.trim() || status === 'sending' || status === 'sent'}
        >
          {status === 'sending' ? 'Skickar…' : 'Skicka länk'}
        </button>
      </form>
      {status === 'sent' && (
        <p className="auth-success">
          Kolla din inkorg på <strong>{email}</strong> och klicka på länken.
        </p>
      )}
      {status === 'error' && errorMessage && (
        <p className="auth-error">Något gick fel: {errorMessage}</p>
      )}
    </main>
  );
}
