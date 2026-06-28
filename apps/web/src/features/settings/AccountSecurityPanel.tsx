import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration
} from '@simplewebauthn/browser';
import type {
  AuthenticationResponseJSON,
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
  const [passkeyBusy, setPasskeyBusy] = useState(false);
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
    setPasskeyBusy(true);
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
    } finally {
      setPasskeyBusy(false);
    }
  };

  const verifyPasskey = async () => {
    if (!browserSupportsWebAuthn()) {
      setError('This browser does not support passkeys.');
      return;
    }
    setError(null);
    setPasskeyBusy(true);
    try {
      const { options } = await api.passkeyAuthenticationOptions(auth!.csrfToken);
      const credential = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON
      });
      if (!passkeyUserVerified(credential)) {
        throw new Error(
          'Passkey device verification was not completed. Try again and approve Windows Hello, device PIN, fingerprint, or face verification.'
        );
      }
      await api.verifyPasskeyAuthentication(auth!.csrfToken, credential);
      setMessage('Passkey verified for this session.');
      await refreshSecurityState();
    } catch (err) {
      setError(passkeyError(err));
    } finally {
      setPasskeyBusy(false);
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
  const passkeyStatusLabel = passkeyRegistered
    ? passkeyVerified ? 'Verified for this login' : 'Registered, verify this login'
    : 'Not registered';
  const canDisableMfa = enabled && !required;
  const lastRequiredPasskey = required && Boolean(passkeyStatus?.count && passkeyStatus.count <= 1);

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
            {passkeyStatusLabel}
          </Status>
          {passkeyRegistered && !passkeyVerified ? (
            <p className="muted">
              This passkey is saved. Verify it once for this login to continue. If verification keeps failing,
              add a replacement passkey from this device first.
            </p>
          ) : null}
          <Field label="Passkey name" hint={platformAvailable ? 'Platform authenticator available on this device.' : undefined}>
            <input
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              maxLength={120}
              placeholder="This device"
            />
          </Field>
          <div className="button-row">
            <Button
              type="button"
              variant={passkeyRegistered ? 'secondary' : 'primary'}
              onClick={registerPasskey}
              disabled={passkeyBusy}
            >
              <Fingerprint size={16} /> Add passkey
            </Button>
            {passkeyRegistered && !passkeyVerified ? (
              <Button type="button" variant="primary" onClick={verifyPasskey} disabled={passkeyBusy}>
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
                    disabled={lastRequiredPasskey}
                    title={lastRequiredPasskey ? 'Add another passkey before removing this one.' : undefined}
                  >
                    <Trash2 size={16} /> Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          {lastRequiredPasskey ? (
            <p className="muted">Owners and admins must keep at least one passkey. Add another passkey before removing this one.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function passkeyError(err: unknown) {
  const message = err instanceof Error ? err.message : '';
  if (message.toLowerCase().includes('notallowed')) return 'Passkey action was cancelled or timed out.';
  if (message.toLowerCase().includes('previously registered') || message.toLowerCase().includes('already registered')) {
    return 'This authenticator still has the old passkey. Try another passkey provider, or remove the old passkey from your device settings and add it again.';
  }
  if (message.toLowerCase().includes('request could not be completed')) {
    return 'Passkey verification could not be completed. Use the same domain and passkey provider you registered with.';
  }
  return message || 'Passkey action failed. Try again.';
}

function passkeyUserVerified(credential: AuthenticationResponseJSON) {
  const data = base64UrlToBytes(credential.response.authenticatorData);
  const flags = data[32] ?? 0;
  return (flags & 0x04) === 0x04;
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
