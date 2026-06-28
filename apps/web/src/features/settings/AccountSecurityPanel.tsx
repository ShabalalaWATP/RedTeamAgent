import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';
import { Fingerprint, KeyRound, QrCode, ShieldCheck, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import { Button, ErrorState, Field, Status } from '../../shared/ui';

type MfaSetup = {
  secret: string;
  provisioning_uri: string;
  recovery_codes: string[];
};

type PasskeyStatus = {
  required: boolean;
  authenticator_app_enabled: boolean;
  passkey_registered: boolean;
  passkey_verified: boolean;
  setup_required: boolean;
  passkey_verification_required: boolean;
  registered: boolean;
  count: number;
  credentials: Array<{ id: string; name: string; created_at: string; last_used_at?: string | null }>;
};

export function AccountSecurityPanel() {
  const { auth, setAuth } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [required, setRequired] = useState(false);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [passkeyName, setPasskeyName] = useState('');
  const [passkeyStatus, setPasskeyStatus] = useState<PasskeyStatus | null>(null);
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshSecurityState();
    void platformAuthenticatorIsAvailable().then(setPlatformAvailable).catch(() => setPlatformAvailable(false));
  }, [auth?.csrfToken]);

  useEffect(() => {
    if (!setup) {
      setQrCode('');
      return;
    }
    void QRCode.toDataURL(setup.provisioning_uri, { margin: 1, width: 184 }).then(setQrCode).catch(() => setQrCode(''));
  }, [setup]);

  const refreshSecurityState = async () => {
    try {
      const [mfa, passkey] = await Promise.all([api.mfaStatus(), api.passkeyStatus()]);
      setEnabled(mfa.enabled);
      setRequired(mfa.required || passkey.required);
      setPasskeyStatus(passkey);
      setAuth({
        ...auth!,
        mfaSetupRequired: passkey.setup_required,
        passkeyVerificationRequired: passkey.passkey_verification_required
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startSetup = async () => {
    setError(null);
    try {
      const nextSetup = await api.setupMfa(auth!.csrfToken);
      setSetup(nextSetup);
      setMessage('Scan the QR code, then enter the current code.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const enable = async () => {
    setError(null);
    try {
      await api.enableMfa(auth!.csrfToken, code);
      setSetup(null);
      setCode('');
      setMessage('Authenticator-app MFA enabled.');
      await refreshSecurityState();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const disable = async () => {
    setError(null);
    try {
      await api.disableMfa(auth!.csrfToken, code);
      setCode('');
      setMessage('Authenticator-app MFA disabled.');
      await refreshSecurityState();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const registerPasskey = async () => {
    if (!browserSupportsWebAuthn()) {
      setError('This browser does not support passkeys.');
      return;
    }
    setError(null);
    try {
      const { options } = await api.passkeyRegistrationOptions(auth!.csrfToken);
      const credential = await startRegistration({
        optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON
      });
      await api.verifyPasskeyRegistration(auth!.csrfToken, credential, passkeyName || undefined);
      setPasskeyName('');
      setMessage('Passkey registered and verified.');
      await refreshSecurityState();
    } catch (err) {
      setError(passkeyError(err));
    }
  };

  const verifyPasskey = async () => {
    if (!browserSupportsWebAuthn()) {
      setError('This browser does not support passkeys.');
      return;
    }
    setError(null);
    try {
      const { options } = await api.passkeyAuthenticationOptions(auth!.csrfToken);
      const credential = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON
      });
      await api.verifyPasskeyAuthentication(auth!.csrfToken, credential);
      setMessage('Passkey verified for this session.');
      await refreshSecurityState();
    } catch (err) {
      setError(passkeyError(err));
    }
  };

  const removePasskey = async (passkeyId: string) => {
    setError(null);
    try {
      await api.deletePasskey(auth!.csrfToken, passkeyId);
      setMessage('Passkey removed.');
      await refreshSecurityState();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const passkeyRegistered = Boolean(passkeyStatus?.registered);
  const passkeyVerified = Boolean(passkeyStatus?.passkey_verified);
  const canDisableMfa = enabled && !required;

  return (
    <section className="settings-block stack">
      <div className="settings-block-header">
        <div>
          <h2><ShieldCheck size={20} /> Account security</h2>
          <p className="muted">
            {required
              ? 'Owner and admin accounts require authenticator-app MFA and a verified passkey.'
              : 'Authenticator-app MFA and passkeys are available for this account.'}
          </p>
        </div>
        <Status tone={enabled && (!required || passkeyVerified) ? 'ok' : required ? 'warn' : 'info'}>
          {enabled && (!required || passkeyVerified) ? 'Protected' : required ? 'Action required' : 'Optional'}
        </Status>
      </div>
      <ErrorState message={error} />
      {message ? <p className="muted" role="status">{message}</p> : null}

      <div className="security-grid">
        <div className="security-method">
          <h3><KeyRound size={18} /> Authenticator app</h3>
          <Status tone={enabled ? 'ok' : required ? 'warn' : 'info'}>{enabled ? 'Enabled' : 'Not enabled'}</Status>
          {setup ? (
            <div className="stack">
              {qrCode ? (
                <div className="qr-panel">
                  <img src={qrCode} alt="Authenticator app QR code" width="184" height="184" />
                </div>
              ) : (
                <p className="muted"><QrCode size={16} /> QR code unavailable. Use the manual setup key.</p>
              )}
              <details className="manual-secret">
                <summary>Manual setup key</summary>
                <input readOnly value={setup.secret} />
              </details>
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
                <KeyRound size={16} /> Enable MFA
              </Button>
            </div>
          ) : null}
          {!setup && !enabled ? (
            <Button type="button" onClick={startSetup}>
              <KeyRound size={16} /> Set up authenticator app
            </Button>
          ) : null}
          {canDisableMfa ? (
            <div className="stack">
              <Field label="Authenticator or recovery code">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={64}
                  autoComplete="one-time-code"
                />
              </Field>
              <Button type="button" onClick={disable} disabled={!code}>Disable MFA</Button>
            </div>
          ) : null}
        </div>

        <div className="security-method">
          <h3><Fingerprint size={18} /> Passkeys</h3>
          <Status tone={passkeyRegistered ? passkeyVerified ? 'ok' : 'warn' : required ? 'warn' : 'info'}>
            {passkeyRegistered ? passkeyVerified ? 'Verified' : 'Registered' : 'Not registered'}
          </Status>
          <Field label="Passkey name" hint={platformAvailable ? 'Platform authenticator available on this device.' : undefined}>
            <input
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              maxLength={120}
              placeholder="This device"
            />
          </Field>
          <div className="button-row">
            <Button type="button" variant={passkeyRegistered ? 'secondary' : 'primary'} onClick={registerPasskey}>
              <Fingerprint size={16} /> Add passkey
            </Button>
            {passkeyRegistered && !passkeyVerified ? (
              <Button type="button" variant="primary" onClick={verifyPasskey}>
                <Fingerprint size={16} /> Verify passkey
              </Button>
            ) : null}
          </div>
          {passkeyStatus?.credentials.length ? (
            <div className="passkey-list">
              {passkeyStatus.credentials.map((item) => (
                <div className="passkey-list-item" key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>Added {new Date(item.created_at).toLocaleDateString()}</small>
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void removePasskey(item.id)}
                    disabled={required && passkeyStatus.count <= 1}
                  >
                    <Trash2 size={16} /> Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function passkeyError(err: unknown) {
  const message = err instanceof Error ? err.message : '';
  if (message.toLowerCase().includes('notallowed')) return 'Passkey action was cancelled or timed out.';
  return message || 'Passkey action failed. Try again.';
}
