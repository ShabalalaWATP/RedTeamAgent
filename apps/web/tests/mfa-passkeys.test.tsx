import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration
} from '@simplewebauthn/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  platformAuthenticatorIsAvailable: vi.fn(() => Promise.resolve(true)),
  startAuthentication: vi.fn(async () => ({ id: 'auth-credential', rawId: 'auth-credential', response: {} })),
  startRegistration: vi.fn(async () => ({ id: 'new-credential', rawId: 'new-credential', response: {} }))
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
  vi.mocked(platformAuthenticatorIsAvailable).mockResolvedValue(true);
  vi.mocked(startAuthentication).mockResolvedValue({
    id: 'auth-credential',
    rawId: 'auth-credential',
    response: {},
  } as Awaited<ReturnType<typeof startAuthentication>>);
  vi.mocked(startRegistration).mockResolvedValue({
    id: 'new-credential',
    rawId: 'new-credential',
    response: {},
  } as Awaited<ReturnType<typeof startRegistration>>);
});

afterEach(() => {
  sessionStorage.clear();
});

describe('MFA passkeys', () => {
  it('gates privileged accounts until required MFA is complete', async () => {
    storeAuth({ accountType: 'owner', mfaSetupRequired: true });
    mockSecurityEndpoints({ required: true });
    renderApp('/workflows');

    expect(await screen.findByRole('heading', { name: /secure account access/i })).toBeInTheDocument();
    expect(screen.getAllByText(/authenticator-app mfa and a verified passkey/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /workflows/i })).not.toBeInTheDocument();
  });

  it('registers a passkey from account security settings', async () => {
    storeAuth();
    mockSecurityEndpoints();
    const user = userEvent.setup();
    renderApp('/settings');

    await user.type(await screen.findByLabelText(/passkey name/i), 'Work laptop');
    await user.click(screen.getByRole('button', { name: /add passkey/i }));

    expect(startRegistration).toHaveBeenCalled();
    expect(await screen.findByText(/passkey registered and verified/i)).toBeInTheDocument();
  });

  it('registers an unnamed passkey with the default label', async () => {
    storeAuth();
    mockSecurityEndpoints();
    const user = userEvent.setup();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /add passkey/i }));

    expect(startRegistration).toHaveBeenCalled();
    expect(await screen.findByText(/passkey registered and verified/i)).toBeInTheDocument();
  });

  it('surfaces fallback passkey errors', async () => {
    vi.mocked(startRegistration).mockRejectedValue('failed');
    storeAuth();
    mockSecurityEndpoints();
    const user = userEvent.setup();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /add passkey/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passkey action failed. Try again.');
  });

  it('verifies a registered passkey for the current session', async () => {
    storeAuth();
    mockSecurityEndpoints({ passkeyRegistered: true, passkeyVerified: false });
    const user = userEvent.setup();
    renderApp('/settings');

    expect(await screen.findByText(/registered, verify this login/i)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /verify passkey/i }));

    expect(startAuthentication).toHaveBeenCalled();
    expect(await screen.findByText(/passkey verified for this session/i)).toBeInTheDocument();
  });

  it('removes a passkey from account security settings', async () => {
    storeAuth();
    const deleted: string[] = [];
    mockSecurityEndpoints({ passkeyRegistered: true }, deleted);
    const user = userEvent.setup();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /remove/i }));

    expect(deleted).toEqual(['passkey-1']);
    expect(await screen.findByText(/passkey removed/i)).toBeInTheDocument();
  });

  it('explains why the last required passkey cannot be removed', async () => {
    storeAuth({ accountType: 'owner' });
    mockSecurityEndpoints({ required: true, mfaEnabled: true, passkeyRegistered: true, passkeyVerified: false });
    renderApp('/settings');

    expect(await screen.findByRole('button', { name: /remove/i })).toBeDisabled();
    expect(screen.getByText(/owners and admins must keep at least one passkey/i)).toBeInTheDocument();
    expect(screen.getByText(/add a replacement passkey from this device first/i)).toBeInTheDocument();
  });

  it('shows protected privileged MFA state once authenticator and passkey are verified', async () => {
    storeAuth({ accountType: 'user' });
    mockSecurityEndpoints({ required: true, mfaEnabled: true, passkeyRegistered: true, passkeyVerified: true });
    renderApp('/settings');

    expect(await screen.findByText(/^protected$/i)).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify passkey/i })).not.toBeInTheDocument();
  });

  it('surfaces passkey registration cancellation', async () => {
    vi.mocked(startRegistration).mockRejectedValue(new Error('NotAllowedError'));
    storeAuth();
    mockSecurityEndpoints();
    const user = userEvent.setup();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /add passkey/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passkey action was cancelled or timed out.');
  });

  it('surfaces passkey verification failure', async () => {
    vi.mocked(startAuthentication).mockRejectedValue(new Error('verification failed'));
    storeAuth();
    mockSecurityEndpoints({ passkeyRegistered: true, passkeyVerified: false });
    const user = userEvent.setup();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /verify passkey/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('verification failed');
  });

  it('explains generic browser passkey failures', async () => {
    vi.mocked(startAuthentication).mockRejectedValue(new Error('The request could not be completed.'));
    storeAuth();
    mockSecurityEndpoints({ passkeyRegistered: true, passkeyVerified: false });
    const user = userEvent.setup();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /verify passkey/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Passkey verification could not be completed. Use the same domain and passkey provider you registered with.'
    );
  });

  it('surfaces unsupported passkey browsers without calling WebAuthn', async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    vi.mocked(platformAuthenticatorIsAvailable).mockResolvedValue(false);
    storeAuth();
    mockSecurityEndpoints();
    const user = userEvent.setup();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /add passkey/i }));

    expect(startRegistration).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('This browser does not support passkeys.');
  });

  it('surfaces unsupported browser verification without calling WebAuthn', async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    storeAuth();
    mockSecurityEndpoints({ passkeyRegistered: true, passkeyVerified: false });
    const user = userEvent.setup();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /verify passkey/i }));

    expect(startAuthentication).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('This browser does not support passkeys.');
  });

  it('surfaces account security status load failures', async () => {
    storeAuth();
    mockSecurityEndpoints({ statusError: true });
    renderApp('/settings');

    expect(await screen.findByRole('alert')).toHaveTextContent('status failed');
  });

  it('continues when platform authenticator availability cannot be detected', async () => {
    vi.mocked(platformAuthenticatorIsAvailable).mockRejectedValue(new Error('unavailable'));
    storeAuth();
    mockSecurityEndpoints();
    renderApp('/settings');

    expect(await screen.findByLabelText(/passkey name/i)).toBeInTheDocument();
    expect(screen.queryByText(/platform authenticator available/i)).not.toBeInTheDocument();
  });
});

function mockSecurityEndpoints(
  options: {
    required?: boolean;
    mfaEnabled?: boolean;
    passkeyRegistered?: boolean;
    passkeyVerified?: boolean;
    statusError?: boolean;
  } = {},
  deleted: string[] = []
) {
  mockFetch((url, init) => {
    const path = new URL(url).pathname;
    if (options.statusError && path === '/auth/mfa/status') return jsonResponse({ message: 'status failed' }, 500);
    if (path === '/auth/mfa/status') {
      return jsonResponse({ enabled: Boolean(options.mfaEnabled), required: Boolean(options.required) });
    }
    if (path === '/auth/passkeys/status') return jsonResponse({
      required: Boolean(options.required),
      authenticator_app_enabled: Boolean(options.mfaEnabled),
      passkey_registered: Boolean(options.passkeyRegistered),
      passkey_verified: Boolean(options.passkeyVerified),
      setup_required: Boolean(options.required),
      passkey_verification_required: Boolean(options.passkeyRegistered && !options.passkeyVerified),
      registered: Boolean(options.passkeyRegistered),
      count: options.passkeyRegistered ? 1 : 0,
      credentials: options.passkeyRegistered ? [{ id: 'passkey-1', name: 'Laptop', created_at: '2026-06-28T00:00:00Z' }] : []
    });
    if (path === '/auth/passkeys/registration/options') return jsonResponse({ options: { challenge: 'registration' } });
    if (path === '/auth/passkeys/registration/verify') {
      expect(init?.method).toBe('POST');
      return jsonResponse(null, 204);
    }
    if (path === '/auth/passkeys/authentication/options') return jsonResponse({ options: { challenge: 'auth' } });
    if (path === '/auth/passkeys/authentication/verify') return jsonResponse(null, 204);
    if (path.startsWith('/auth/passkeys/') && init?.method === 'DELETE') {
      deleted.push(path.split('/').pop() ?? '');
      return jsonResponse(null, 204);
    }
    if (path === '/providers/adapters') return jsonResponse([]);
    if (path === '/providers/connections') return jsonResponse([]);
    if (path === '/providers/models') return jsonResponse([]);
    if (path === '/providers/profiles') return jsonResponse([]);
    return jsonResponse({ message: 'unexpected' }, 500);
  });
}
