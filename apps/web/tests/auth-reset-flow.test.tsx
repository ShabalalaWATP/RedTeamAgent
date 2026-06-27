import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch, renderApp } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('Auth reset flow', () => {
  it('opens emailed reset links in confirmation mode without requesting another reset', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch((url, init) => {
      if (url.includes('/auth/password-reset/confirm')) {
        expect(JSON.parse(String(init?.body))).toEqual({
          token: 'reset-token',
          password: 'Another-Correct-43!'
        });
        return jsonResponse(null, 204);
      }
      return jsonResponse({ message: 'unexpected request' }, 500);
    });

    renderApp('/auth?reset_token=reset-token');

    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/security check/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/new password/i), 'Another-Correct-43!');
    await user.click(screen.getByRole('button', { name: /confirm reset/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/password updated/i)).toBeInTheDocument();
  });
});
