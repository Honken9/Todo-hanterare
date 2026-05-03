import { useState } from 'react';
import { supabase } from './lib/supabase';
import { sendPasswordReset } from './api';

type Mode = 'login' | 'reset';
type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('idle');
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage(null);
    try {
      await sendPasswordReset(email);
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  if (mode === 'reset') {
    return (
      <main className="app auth">
        <h1>Återställ lösenord</h1>
        <p>Skriv in din e-post så skickar vi en länk för att sätta nytt lösenord.</p>
        <form className="composer" onSubmit={handleReset}>
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
            disabled={
              !email.trim() || status === 'sending' || status === 'sent'
            }
          >
            {status === 'sending' ? 'Skickar…' : 'Skicka länk'}
          </button>
        </form>
        {status === 'sent' && (
          <p className="auth-success">
            Kolla din inkorg på <strong>{email}</strong>.
          </p>
        )}
        {status === 'error' && errorMessage && (
          <p className="auth-error">{errorMessage}</p>
        )}
        <button
          className="ghost link"
          onClick={() => {
            setMode('login');
            setStatus('idle');
            setErrorMessage(null);
          }}
        >
          ← Tillbaka till inloggning
        </button>
      </main>
    );
  }

  return (
    <main className="app auth">
      <h1>Logga in</h1>
      <form className="auth-form" onSubmit={handleLogin}>
        <label className="col">
          <span className="col-header">E-post</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            disabled={status === 'sending'}
          />
        </label>
        <label className="col">
          <span className="col-header">Lösenord</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={status === 'sending'}
          />
        </label>
        <button
          type="submit"
          disabled={!email.trim() || !password || status === 'sending'}
        >
          {status === 'sending' ? 'Loggar in…' : 'Logga in'}
        </button>
      </form>
      {status === 'error' && errorMessage && (
        <p className="auth-error">{errorMessage}</p>
      )}
      <button
        className="ghost link"
        onClick={() => {
          setMode('reset');
          setStatus('idle');
          setErrorMessage(null);
        }}
      >
        Glömt lösenord?
      </button>
    </main>
  );
}
