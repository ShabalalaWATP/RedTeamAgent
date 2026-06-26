import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptchaChallenge } from '../src/features/auth/CaptchaChallenge';
import { jsonResponse, mockFetch } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  document.head.querySelectorAll('script[src*="turnstile"]').forEach((script) => script.remove());
});

describe('CaptchaChallenge', () => {
  it('does nothing while inactive', () => {
    const onToken = vi.fn();
    mockFetch(() => jsonResponse({ message: 'unexpected' }, 500));
    render(<CaptchaChallenge active={false} onToken={onToken} onError={vi.fn()} />);

    expect(screen.queryByLabelText(/security check/i)).not.toBeInTheDocument();
    expect(onToken).toHaveBeenCalledWith('');
  });

  it('uses Turnstile when a site key is configured', () => {
    const onToken = vi.fn();
    render(<CaptchaChallenge active siteKey="site-key" onToken={onToken} onError={vi.fn()} />);

    expect(document.querySelector('.auth-turnstile')).toBeInTheDocument();
    expect(onToken).toHaveBeenCalledWith('');
  });

  it('allows submission when the server says CAPTCHA is disabled', async () => {
    const onToken = vi.fn();
    mockFetch((url) => {
      if (url.includes('/auth/captcha/challenge')) {
        return jsonResponse({ required: false, provider: 'disabled', token: '', prompt: '', expires_in_seconds: 0 });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    render(<CaptchaChallenge active onToken={onToken} onError={vi.fn()} />);

    await waitFor(() => expect(onToken).toHaveBeenCalledWith('not-required'));
    expect(screen.queryByLabelText(/security check/i)).not.toBeInTheDocument();
  });

  it('reports a missing Turnstile site key when the server requires Turnstile', async () => {
    const onError = vi.fn();
    mockFetch((url) => {
      if (url.includes('/auth/captcha/challenge')) {
        return jsonResponse({ required: true, provider: 'turnstile', token: '', prompt: '', expires_in_seconds: 0 });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    render(<CaptchaChallenge active onToken={vi.fn()} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Security check is not configured.'));
  });

  it('reports an unavailable challenge endpoint', async () => {
    const onError = vi.fn();
    mockFetch(() => {
      throw new Error('offline');
    });
    render(<CaptchaChallenge active onToken={vi.fn()} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Security check is unavailable. Try again.'));
  });

  it('emits the signed challenge token with the answer', async () => {
    const user = userEvent.setup();
    const onToken = vi.fn();
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
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    render(<CaptchaChallenge active onToken={onToken} onError={vi.fn()} />);

    await user.type(await screen.findByLabelText(/security check/i), '5');
    await waitFor(() => expect(onToken).toHaveBeenCalledWith('challenge:signed-challenge:5'));
  });
});
