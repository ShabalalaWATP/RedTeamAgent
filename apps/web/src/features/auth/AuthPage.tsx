import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import { Button, ErrorState, Field, Status } from '../../shared/ui';

const DEFAULT_PASSWORD = 'correct horse battery';

export function AuthPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState('alex@example.com');
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [verificationToken, setVerificationToken] = useState('');
  const [message, setMessage] = useState('Create an account, verify it, then sign in.');
  const [error, setError] = useState<string | null>(null);

  const register = async () => {
    setError(null);
    try {
      const response = await api.register(email, password);
      setVerificationToken(response.verification_token ?? '');
      setMessage('Verification token issued for local development.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const verify = async () => {
    setError(null);
    try {
      await api.verifyEmail(verificationToken);
      setMessage('Email verified. You can sign in.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const login = async () => {
    setError(null);
    try {
      const response = await api.login(email, password);
      setAuth({
        userId: response.user.id,
        email: response.user.email,
        workspaceId: response.workspace.id,
        workspaceName: response.workspace.name,
        csrfToken: response.csrf_token ?? ''
      });
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const reset = async () => {
    setError(null);
    const response = await api.resetPassword(email);
    setMessage(response.reset_token ? 'Password reset token issued.' : 'If the account exists, reset was requested.');
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="panel stack">
          <Status tone="info">Secure foundation</Status>
          <h1>RedTeamAgent</h1>
          <p className="muted">
            Evidence-led reviews with tenant isolation, provider-neutral routing and structured reports.
          </p>
          <div className="row">
            <Status tone="ok">HttpOnly sessions</Status>
            <Status tone="ok">Argon2id</Status>
            <Status tone="warn">Local fake provider</Status>
          </div>
        </div>
        <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
          <h2>Sign in</h2>
          <Field label="Email">
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          </Field>
          <Field label="Password">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </Field>
          <Field label="Verification token" hint="Returned only in local development.">
            <input value={verificationToken} onChange={(event) => setVerificationToken(event.target.value)} />
          </Field>
          <ErrorState message={error} />
          <p className="muted" role="status">{message}</p>
          <div className="row">
            <Button type="button" onClick={register}>Register</Button>
            <Button type="button" onClick={verify} disabled={!verificationToken}>Verify email</Button>
            <Button type="button" variant="primary" onClick={login}>Log in</Button>
            <Button type="button" onClick={reset}>Reset</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
