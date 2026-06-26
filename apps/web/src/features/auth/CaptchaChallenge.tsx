import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { Field } from '../../shared/ui';

type ChallengeState = {
  required: boolean;
  provider: 'disabled' | 'turnstile' | 'challenge';
  token: string;
  prompt: string;
  expires_in_seconds: number;
};

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function CaptchaChallenge({
  active,
  siteKey,
  onToken,
  onError
}: {
  active: boolean;
  siteKey?: string;
  onToken: (token: string) => void;
  onError: (message: string) => void;
}) {
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    setAnswer('');
    onToken('');
    if (!active || siteKey) {
      setChallenge(null);
      return;
    }

    let cancelled = false;
    void api.captchaChallenge()
      .then((next) => {
        if (cancelled) return;
        setChallenge(next);
        if (!next.required) onToken('not-required');
        if (next.required && next.provider !== 'challenge') onError('Security check is not configured.');
      })
      .catch(() => {
        if (!cancelled) onError('Security check is unavailable. Try again.');
      });

    return () => {
      cancelled = true;
      onToken('');
    };
  }, [active, onError, onToken, siteKey]);

  useEffect(() => {
    if (!active || siteKey) return;
    if (!challenge?.required) {
      if (challenge) onToken('not-required');
      return;
    }
    if (challenge.provider !== 'challenge' || !answer.trim()) {
      onToken('');
      return;
    }
    onToken(`challenge:${challenge.token}:${answer.trim()}`);
  }, [active, answer, challenge, onToken, siteKey]);

  if (!active) return null;
  if (siteKey) return <TurnstileChallenge siteKey={siteKey} onToken={onToken} />;
  if (!challenge?.required || challenge.provider !== 'challenge') return null;

  return (
    <Field label="Security check" hint={challenge.prompt}>
      <input
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        inputMode="numeric"
        maxLength={8}
        autoComplete="off"
      />
    </Field>
  );
}

/* v8 ignore start -- external Turnstile script lifecycle is exercised by browser integration, not unit tests. */
function TurnstileChallenge({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
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

  return <div className="auth-turnstile" ref={containerRef} />;
}
/* v8 ignore stop */
