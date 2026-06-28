import { FileText, ListChecks, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiRequestError, api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import { ThemeToggle } from '../../app/ThemeToggle';
import logo from '../../assets/redteamagent-logo.png';
import EvilEye from '../../shared/EvilEye/EvilEye';
import { Button, ErrorState, Field } from '../../shared/ui';
import { CaptchaChallenge } from './CaptchaChallenge';
import { PasswordField, passwordMeetsPolicy } from './PasswordField';
import './auth.css';
import './authFx.css';

const AUTH_FEATURES = [
  {
    icon: Shield,
    title: 'Spot hidden bias',
    body: 'Find the assumptions and blind spots quietly steering the decision.'
  },
  {
    icon: ListChecks,
    title: 'Find the blockers',
    body: 'Surface the people, process and technical snags that could slow you down.'
  },
  {
    icon: FileText,
    title: 'Reality-check the plan',
    body: 'Separate wishful thinking from what the evidence actually supports.'
  }
] as const;

type AuthMode = 'login' | 'register' | 'reset';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

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
  if (err instanceof ApiRequestError && err.code === 'rate_limit_exceeded') {
    return 'Too many sign-in attempts. Wait a minute, then try again.';
  }
  if (message.includes('too many requests')) {
    return 'Too many sign-in attempts. Wait a minute, then try again.';
  }
  return 'Email or password is incorrect.';
}

function requiresMfaCode(err: unknown) {
  if (err instanceof ApiRequestError && err.code === 'mfa_required') return true;
  return String(err).toLowerCase().includes('multi-factor authentication code required');
}

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuth();
  const verificationLinkToken = searchParams.get('verification_token');
  const [mode, setMode] = useState<AuthMode>(() => initialMode(searchParams));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  const hasResetToken = Boolean(resetToken);
  const captchaActive = mode === 'register' || (mode === 'reset' && !hasResetToken);
  const captchaReady = !captchaActive || Boolean(captchaToken);
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
    if (nextMode !== 'reset') {
      setResetToken('');
      setNewPassword('');
    }
    setMode(nextMode);
    setMessage(initialMessage(nextMode));
  };

  const register = async () => {
    setError(null);
    try {
      await api.register(email, password, captchaToken || undefined);
      setMessage('Check your email for the verification link.');
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
        accountType: response.user.account_type,
        accountStatus: response.user.account_status,
        csrfToken: response.csrf_token ?? '',
        mfaSetupRequired: response.mfa_setup_required,
        passkeyVerificationRequired: response.passkey_verification_required
      });
      navigate(response.mfa_setup_required || response.passkey_verification_required ? '/settings' : '/workflows');
    } catch (err) {
      if (requiresMfaCode(err)) {
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
      await api.resetPassword(email, captchaToken || undefined);
      setMessage('If the account exists, a reset link was sent.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const confirmReset = async () => {
    setError(null);
    try {
      await api.confirmResetPassword(resetToken, newPassword);
      setPassword(newPassword);
      setResetToken('');
      setNewPassword('');
      setMode('login');
      setMessage('Password updated. Sign in with your new password.');
      navigate('/auth', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <ThemeToggle className="auth-theme-toggle" />
        <div className="auth-brand-panel">
          <div className="auth-brand-top">
            <span className="auth-logo-wrap">
              <img className="auth-logo" src={logo} alt="" width="176" height="176" />
            </span>
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
        </div>
        <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
          <div className="auth-form-header">
            <p className="auth-kicker">
              {mode === 'login' ? 'Secure access' : mode === 'register' ? 'Get started' : 'Account recovery'}
            </p>
            <h2>{mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password'}</h2>
            <p className="muted">
              {mode === 'login'
                ? 'Use your account.'
                : mode === 'register'
                  ? 'Create your account.'
                  : hasResetToken
                    ? 'Choose a new password.'
                    : 'Request a reset link for your account.'}
            </p>
          </div>

          {mode === 'reset' && hasResetToken ? null : (
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
          )}
          {mode === 'reset' ? null : (
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              showRequirements={mode === 'register'}
            />
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
            <CaptchaChallenge
              active={captchaActive}
              siteKey={TURNSTILE_SITE_KEY}
              onToken={setCaptchaToken}
              onError={setError}
            />
          ) : null}

          {mode === 'reset' && resetToken ? (
            <div className="auth-inline-panel">
              <PasswordField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                showRequirements
              />
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
                {!hasResetToken ? (
                  <Button type="button" variant="primary" onClick={reset} disabled={!email || !captchaReady}>Send reset link</Button>
                ) : null}
                <button className="auth-text-button" type="button" onClick={() => switchMode('login')}>
                  Back to sign in
                </button>
              </>
            ) : null}
          </div>
        </form>
        <div className="auth-eye" aria-hidden="true">
          <EvilEye eyeColor="#ff465c" intensity={1.5} glowIntensity={0.4} scale={0.95} flameSpeed={0.8} />
        </div>
      </section>
    </div>
  );
}
