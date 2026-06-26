import { FileText, ListChecks, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiRequestError, api } from '../../api/client';
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

const PASSWORD_HINT = 'Use 14-128 characters with uppercase, lowercase, a number and a symbol.';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

function passwordMeetsPolicy(value: string) {
  return (
    value.length >= 14 &&
    value.length <= 128 &&
    value.trim() === value &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^\dA-Za-z\s]/.test(value)
  );
}

function initialMode(searchParams: URLSearchParams): AuthMode {
  if (searchParams.get('reset_token')) return 'reset';
  return 'login';
}

function initialMessage(mode: AuthMode) {
  if (mode === 'register') return 'Verify your email, then sign in.';
  if (mode === 'reset') return 'Reset your password, then sign in.';
  return 'Enter your account details.';
}

function loginErrorMessage(err: unknown) {
  const message = String(err).toLowerCase();
  if (message.includes('failed to fetch')) {
    return 'Sign in is unavailable. Check the service and try again.';
  }
  return 'Email or password is incorrect.';
}

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuth();
  const verificationLinkToken = searchParams.get('verification_token');
  const [mode, setMode] = useState<AuthMode>(() => initialMode(searchParams));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [resetToken, setResetToken] = useState(searchParams.get('reset_token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [message, setMessage] = useState(() =>
    verificationLinkToken ? 'Verifying your email...' : initialMessage(mode)
  );
  const [error, setError] = useState<string | null>(null);
  const verificationAttempted = useRef(false);
  const captchaReady = !TURNSTILE_SITE_KEY || Boolean(captchaToken);
  const canRegister = Boolean(email) && passwordMeetsPolicy(password) && captchaReady;
  const canConfirmReset = Boolean(resetToken) && passwordMeetsPolicy(newPassword);

  useEffect(() => {
    if (!verificationLinkToken || verificationAttempted.current) return;
    verificationAttempted.current = true;
    setError(null);
    void api.verifyEmail(verificationLinkToken)
      .then(() => {
        setMode('login');
        setMessage('Email verified. Sign in to continue.');
        navigate('/auth', { replace: true });
      })
      .catch((err: unknown) => {
        setMessage('Email verification failed.');
        setError((err as Error).message);
      });
  }, [navigate, verificationLinkToken]);

  const switchMode = (nextMode: AuthMode) => {
    setError(null);
    setRequiresMfa(false);
    setMfaCode('');
    setCaptchaToken('');
    setMode(nextMode);
    setMessage(initialMessage(nextMode));
  };

  const register = async () => {
    setError(null);
    try {
      const response = await api.register(email, password, captchaToken || undefined);
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
      const response = await api.login(email, password, requiresMfa ? mfaCode : undefined);
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
      if (err instanceof ApiRequestError && err.code === 'mfa_required') {
        setRequiresMfa(true);
        setMessage('Enter your authenticator code or recovery code.');
        setError(null);
        return;
      }
      setError(loginErrorMessage(err));
    }
  };

  const reset = async () => {
    setError(null);
    try {
      const response = await api.resetPassword(email, captchaToken || undefined);
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
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              maxLength={320}
              spellCheck={false}
            />
          </Field>

          {mode === 'reset' ? null : (
            <Field label="Password" hint={mode === 'register' ? PASSWORD_HINT : undefined}>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={128}
              />
            </Field>
          )}

          {mode === 'login' && requiresMfa ? (
            <Field label="Authenticator or recovery code">
              <input
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                autoComplete="one-time-code"
                maxLength={64}
              />
            </Field>
          ) : null}

          {mode === 'register' || mode === 'reset' ? (
            <TurnstileChallenge siteKey={TURNSTILE_SITE_KEY} onToken={setCaptchaToken} />
          ) : null}

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
              <Field label="New password" hint={PASSWORD_HINT}>
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                />
              </Field>
              <Button type="button" onClick={confirmReset} disabled={!canConfirmReset}>
                Confirm reset
              </Button>
            </div>
          ) : null}

          <ErrorState message={error} />
          <p className="auth-message" role="status">{message}</p>

          <div className="auth-actions">
            {mode === 'login' ? (
              <>
                <Button type="button" variant="primary" onClick={login} disabled={!email || !password || (requiresMfa && !mfaCode)}>Sign in</Button>
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
                <Button type="button" variant="primary" onClick={register} disabled={!canRegister}>
                  Create account
                </Button>
                <button className="auth-text-button" type="button" onClick={() => switchMode('login')}>
                  Back to sign in
                </button>
              </>
            ) : null}

            {mode === 'reset' ? (
              <>
                <Button type="button" variant="primary" onClick={reset} disabled={!email || !captchaReady}>Send reset code</Button>
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

/* v8 ignore start -- external Turnstile script lifecycle is exercised by browser integration, not unit tests. */
function TurnstileChallenge({ siteKey, onToken }: { siteKey?: string; onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetRef.current) return;
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken('')
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      render();
    } else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
      onToken('');
    };
  }, [onToken, siteKey]);

  if (!siteKey) return null;
  return <div className="auth-turnstile" ref={containerRef} />;
}
/* v8 ignore stop */
