import { useState } from 'react';
import { changePassword } from './api';

export type SetPasswordReason = 'invite' | 'recovery';

export default function SetPassword({
  reason,
  onDone,
}: {
  reason: SetPasswordReason;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (password.length < 8) {
      setErrorMessage('Lösenordet måste vara minst 8 tecken.');
      return;
    }
    if (password !== confirm) {
      setErrorMessage('Lösenorden matchar inte.');
      return;
    }
    setStatus('saving');
    try {
      await changePassword(password);
      window.history.replaceState(null, '', window.location.pathname);
      onDone();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  const heading =
    reason === 'invite' ? 'Välkommen — sätt ditt lösenord' : 'Sätt nytt lösenord';

  return (
    <main className="app auth">
      <h1>{heading}</h1>
      <p>Välj ett lösenord du kommer ihåg. Minst 8 tecken.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="col">
          <span className="col-header">Nytt lösenord</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
            disabled={status === 'saving'}
          />
        </label>
        <label className="col">
          <span className="col-header">Bekräfta</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={status === 'saving'}
          />
        </label>
        <button
          type="submit"
          disabled={!password || !confirm || status === 'saving'}
        >
          {status === 'saving' ? 'Sparar…' : 'Spara'}
        </button>
      </form>
      {errorMessage && <p className="auth-error">{errorMessage}</p>}
    </main>
  );
}
