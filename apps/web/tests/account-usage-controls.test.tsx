import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('account and usage controls', () => {
  it('shows auth errors, supports reset and updates fields', async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/auth/captcha/challenge')) {
        return jsonResponse({
          required: true,
          provider: 'challenge',
          token: 'signed-challenge',
          prompt: 'What is 2 + 3?',
          expires_in_seconds: 300
        });
      }
      if (url.includes('/auth/register')) return jsonResponse({ message: 'duplicate' }, 409);
      if (url.includes('/auth/verify-email')) return jsonResponse({ message: 'bad token' }, 401);
      if (url.includes('/auth/login')) return jsonResponse({ message: 'bad login' }, 401);
      if (url.includes('/auth/password-reset/confirm')) return jsonResponse(null, 204);
      if (url.includes('/auth/password-reset/request')) {
        return jsonResponse({
          user: { id: 'zero', email: 'new@example.com', is_verified: false },
          workspace: { id: 'zero', name: 'none' },
          reset_token: 'reset-token'
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/auth');
    await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Another-Safe-42!');
    await user.click(screen.getByRole('button', { name: /create an account/i }));
    await user.type(await screen.findByLabelText(/security check/i), '5');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('duplicate');
    await user.click(screen.getByRole('button', { name: /back to sign in/i }));
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    await user.click(screen.getByRole('button', { name: /forgot password/i }));
    await user.type(await screen.findByLabelText(/security check/i), '5');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));
    expect(await screen.findByText(/reset token issued/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/new password/i), 'Another-Safe-43!');
    await user.click(screen.getByRole('button', { name: /confirm reset/i }));
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });

  it('hides raw validation status on malformed sign-in attempts', async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/auth/login')) return jsonResponse({ detail: [{ msg: 'value is not a valid email' }] }, 422);
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/auth');
    await user.type(screen.getByLabelText(/^email$/i), 'not-a-real-email');
    await user.type(screen.getByLabelText(/^password$/i), 'Wrong-Password-42!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.queryByText(/422/)).not.toBeInTheDocument();
  });

  it('shows a service message when sign-in cannot reach the API', async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/auth/login')) throw new Error('Failed to fetch');
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/auth');
    await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Wrong-Password-42!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign in is unavailable. Check the service and try again.'
    );
  });

  it('prompts for MFA when the API requires a second factor', async () => {
    const user = userEvent.setup();
    let loginCalls = 0;
    mockFetch((url) => {
      if (url.includes('/auth/login')) {
        loginCalls += 1;
        if (loginCalls === 1) {
          return jsonResponse({ code: 'mfa_required', message: 'Multi-factor authentication code required.' }, 401);
        }
        return jsonResponse({
          user: { id: 'user-1', email: 'new@example.com', is_verified: true },
          workspace: { id: 'workspace-1', name: 'Personal workspace' },
          workspace_role: 'owner',
          csrf_token: 'csrf-token'
        });
      }
      if (url.includes('/workspaces/workspace-1/workflows')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/auth');
    await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Correct-Horse-42!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByLabelText(/authenticator or recovery code/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/authenticator or recovery code/i), '123456');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeInTheDocument();
  });

  it('surfaces verification errors from a local verification link', async () => {
    mockFetch((url) => {
      if (url.includes('/auth/verify-email')) return jsonResponse({ message: 'bad token' }, 401);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/auth?verification_token=bad');
    expect(await screen.findByRole('alert')).toHaveTextContent('bad token');
    expect(screen.queryByLabelText(/verification token/i)).not.toBeInTheDocument();
  });

  it('starts from the proposal box and surfaces daily quota errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    let usageCalls = 0;
    mockFetch((url, init) => {
      if (url.includes('/usage/limits')) return usageResponse(++usageCalls);
      if (url.includes('/context-packs?')) return jsonResponse([]);
      if (url.includes('/projects/project-1/reviews') && init?.method === 'POST') {
        return jsonResponse({
          id: 'review-quota',
          workspace_id: authState.workspaceId,
          project_id: 'project-1',
          title: 'Decision readiness review',
          proposal_text: 'proposal',
          mode: 'standard',
          focus_chips: ['security']
        });
      }
      if (url.includes('/reviews/review-quota/sources/text')) {
        return jsonResponse({
          id: 'source-quota',
          filename: 'proposal.md',
          content_type: 'text/markdown',
          state: 'ingested',
          metadata: {},
          warnings: []
        });
      }
      if (url.includes('/reviews/review-quota/runs') && init?.method === 'POST') {
        return jsonResponse({ message: 'Daily review run limit reached.' }, 429);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/projects/project-1/reviews/new');
    expect(await screen.findByText(/1 runs left today/i)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^proposal$/i));
    await user.type(screen.getByLabelText(/^proposal$/i), 'Red team this hiring plan.');
    await user.click(screen.getByRole('button', { name: /run review/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Daily review run limit reached.');
    expect(await screen.findByText(/0 runs left today/i)).toBeInTheDocument();
  });
});

function usageResponse(callCount: number) {
  return jsonResponse({
    daily_review_run_limit: 1,
    runs_started_today: callCount > 1 ? 1 : 0,
    runs_remaining_today: callCount > 1 ? 0 : 1,
    resets_at: '2026-06-25T00:00:00Z'
  });
}
