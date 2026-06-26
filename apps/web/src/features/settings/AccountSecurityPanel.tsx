import { KeyRound, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import { Button, ErrorState, Field } from '../../shared/ui';

type MfaSetup = {
  secret: string;
  provisioning_uri: string;
  recovery_codes: string[];
};

export function AccountSecurityPanel() {
  const { auth } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.mfaStatus().then((status) => setEnabled(status.enabled)).catch((err) => setError((err as Error).message));
  }, []);

  const startSetup = async () => {
    setError(null);
    try {
      const nextSetup = await api.setupMfa(auth!.csrfToken);
      setSetup(nextSetup);
      setMessage('Scan the authenticator URI, then enter the current code.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const enable = async () => {
    setError(null);
    try {
      await api.enableMfa(auth!.csrfToken, code);
      setEnabled(true);
      setSetup(null);
      setCode('');
      setMessage('Two-factor authentication enabled.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const disable = async () => {
    setError(null);
    try {
      await api.disableMfa(auth!.csrfToken, code);
      setEnabled(false);
      setCode('');
      setMessage('Two-factor authentication disabled.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="settings-block stack">
      <div className="settings-block-header">
        <div>
          <h2><ShieldCheck size={20} /> Account security</h2>
          <p className="muted">
            {enabled ? 'Two-factor authentication is enabled.' : 'Two-factor authentication is optional.'}
          </p>
        </div>
      </div>
      <ErrorState message={error} />
      {message ? <p className="muted" role="status">{message}</p> : null}
      {setup ? (
        <div className="stack">
          <Field label="Authenticator URI">
            <textarea readOnly value={setup.provisioning_uri} rows={3} />
          </Field>
          <Field label="Manual secret">
            <input readOnly value={setup.secret} />
          </Field>
          <div className="recovery-grid" aria-label="Recovery codes">
            {setup.recovery_codes.map((item) => <code key={item}>{item}</code>)}
          </div>
          <Field label="Authenticator code">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={64}
              autoComplete="one-time-code"
            />
          </Field>
          <Button type="button" variant="primary" onClick={enable} disabled={!code}>
            <KeyRound size={16} /> Enable 2FA
          </Button>
        </div>
      ) : null}
      {!setup && !enabled ? (
        <Button type="button" onClick={startSetup}>
          <KeyRound size={16} /> Set up 2FA
        </Button>
      ) : null}
      {enabled ? (
        <div className="stack">
          <Field label="Authenticator or recovery code">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={64}
              autoComplete="one-time-code"
            />
          </Field>
          <Button type="button" onClick={disable} disabled={!code}>Disable 2FA</Button>
        </div>
      ) : null}
    </section>
  );
}
