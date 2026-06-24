import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import { Button, ErrorState, Field, Status } from '../../shared/ui';

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState(searchParams.get('verification_token') ?? '');
  const [resetToken, setResetToken] = useState(searchParams.get('reset_token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState(
    verificationToken ? 'Verification link detected.' : 'Create an account or log in.'
  );
  const [error, setError] = useState<string | null>(null);

  const register = async () => {
    setError(null);
    try {
      const response = await api.register(email, password);
      setVerificationToken(response.verification_token ?? '');
      setMessage(
        response.verification_token ? 'Local verification token issued.' : 'Check your email for the verification link.'
      );
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
        workspaceRole: response.workspace_role ?? 'member',
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
    setResetToken(response.reset_token ?? '');
    setMessage(response.reset_token ? 'Local password reset token issued.' : 'If the account exists, reset was requested.');
  };

  const confirmReset = async () => {
    setError(null);
    try {
      await api.confirmResetPassword(resetToken, newPassword);
      setPassword(newPassword);
      setMessage('Password updated. You can log in.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="panel stack">
          <Status tone="info">Account access</Status>
          <h1>RedTeamAgent</h1>
          <p className="muted">
            Evidence-led red teaming for decisions, proposals, essays, projects, policies and code changes.
          </p>
          <div className="row">
            <Status tone="ok">HttpOnly sessions</Status>
            <Status tone="ok">Argon2id</Status>
            <Status tone="warn">Local fake provider</Status>
          </div>
        </div>
        <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
          <h2>Sign up or log in</h2>
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
          <Field label="Reset token" hint="Only needed after a password reset email.">
            <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} />
          </Field>
          <Field label="New password">
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </Field>
          <ErrorState message={error} />
          <p className="muted" role="status">{message}</p>
          <div className="row">
            <Button type="button" onClick={register} disabled={!email || password.length < 12}>Register</Button>
            <Button type="button" onClick={verify} disabled={!verificationToken}>Verify email</Button>
            <Button type="button" variant="primary" onClick={login} disabled={!email || !password}>Log in</Button>
            <Button type="button" onClick={reset} disabled={!email}>Send reset</Button>
            <Button type="button" onClick={confirmReset} disabled={!resetToken || newPassword.length < 12}>
              Confirm reset
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
