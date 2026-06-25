import { FileText, ListChecks, Shield } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import logo from '../../assets/redteamagent-logo.png';
import { Button, ErrorState, Field } from '../../shared/ui';
import './auth.css';

const AUTH_FEATURES = [
  {
    icon: Shield,
    title: 'Adversarial multi-agent review',
    body: 'Specialist agents stress-test proposals, plans, code and writing.'
  },
  {
    icon: ListChecks,
    title: 'Evidence-linked findings',
    body: 'Every risk ties back to a source, scored in a clear risk matrix.'
  },
  {
    icon: FileText,
    title: 'Decision-ready reports',
    body: 'Export structured decision support, with assumptions shown.'
  }
] as const;

type AuthMode = 'login' | 'register' | 'reset';

function initialMode(searchParams: URLSearchParams): AuthMode {
  if (searchParams.get('reset_token')) return 'reset';
  if (searchParams.get('verification_token')) return 'register';
  return 'login';
}

function initialMessage(mode: AuthMode) {
  if (mode === 'register') return 'Verify your email, then sign in.';
  if (mode === 'reset') return 'Reset your password, then sign in.';
  return 'Enter your account details.';
}

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuth();
  const [mode, setMode] = useState<AuthMode>(() => initialMode(searchParams));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState(searchParams.get('verification_token') ?? '');
  const [resetToken, setResetToken] = useState(searchParams.get('reset_token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState(() => initialMessage(mode));
  const [error, setError] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    setError(null);
    setMode(nextMode);
    setMessage(initialMessage(nextMode));
  };

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
      setMode('login');
      setMessage('Email verified. Sign in to continue.');
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
      navigate('/workflows');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const reset = async () => {
    setError(null);
    try {
      const response = await api.resetPassword(email);
      setResetToken(response.reset_token ?? '');
      setMessage(
        response.reset_token ? 'Local password reset token issued.' : 'If the account exists, reset was requested.'
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const confirmReset = async () => {
    setError(null);
    try {
      await api.confirmResetPassword(resetToken, newPassword);
      setPassword(newPassword);
      setMode('login');
      setMessage('Password updated. Sign in with your new password.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand-panel">
          <div className="auth-brand-top">
            <img className="auth-logo" src={logo} alt="" width="192" height="192" />
            <div>
              <h1 id="auth-title">RedTeamAgent</h1>
              <p className="auth-tagline">Adversarial review for the decisions that matter.</p>
            </div>
          </div>
          <ul className="auth-features">
            {AUTH_FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="auth-feature-icon"><Icon aria-hidden="true" size={18} /></span>
                <div>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="auth-brand-foot">Provisional decision support, not professional sign-off.</p>
        </div>
        <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
          <div className="auth-form-header">
            <h2>{mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password'}</h2>
            <p className="muted">
              {mode === 'login'
                ? 'Use your account.'
                : mode === 'register'
                  ? 'Create your account.'
                  : 'Request a reset code for your account.'}
            </p>
          </div>

          <Field label="Email">
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          </Field>

          {mode === 'reset' ? null : (
            <Field label="Password">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>
          )}

          {mode === 'register' && verificationToken ? (
            <div className="auth-inline-panel">
              <Field label="Verification token" hint="Returned only in local development.">
                <input value={verificationToken} onChange={(event) => setVerificationToken(event.target.value)} />
              </Field>
              <Button type="button" onClick={verify} disabled={!verificationToken}>Verify email</Button>
            </div>
          ) : null}

          {mode === 'reset' && resetToken ? (
            <div className="auth-inline-panel">
              <Field label="Reset token" hint="Returned only in local development.">
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
              <Button type="button" onClick={confirmReset} disabled={!resetToken || newPassword.length < 12}>
                Confirm reset
              </Button>
            </div>
          ) : null}

          <ErrorState message={error} />
          <p className="auth-message" role="status">{message}</p>

          <div className="auth-actions">
            {mode === 'login' ? (
              <>
                <Button type="button" variant="primary" onClick={login} disabled={!email || !password}>Sign in</Button>
                <button className="auth-text-button" type="button" onClick={() => switchMode('register')}>
                  Create an account
                </button>
                <button className="auth-text-button" type="button" onClick={() => switchMode('reset')}>
                  Forgot password?
                </button>
              </>
            ) : null}

            {mode === 'register' ? (
              <>
                <Button type="button" variant="primary" onClick={register} disabled={!email || password.length < 12}>
                  Create account
                </Button>
                <button className="auth-text-button" type="button" onClick={() => switchMode('login')}>
                  Back to sign in
                </button>
              </>
            ) : null}

            {mode === 'reset' ? (
              <>
                <Button type="button" variant="primary" onClick={reset} disabled={!email}>Send reset code</Button>
                <button className="auth-text-button" type="button" onClick={() => switchMode('login')}>
                  Back to sign in
                </button>
              </>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
