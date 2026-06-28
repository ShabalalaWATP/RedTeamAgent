import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { App } from '../src/app/App';

export const authState = {
  userId: 'user-1',
  email: 'owner@example.com',
  workspaceId: 'workspace-1',
  workspaceName: "owner@example.com's workspace",
  workspaceRole: 'owner',
  accountType: 'user',
  accountStatus: 'active',
  csrfToken: 'csrf-token',
  mfaSetupRequired: false,
  passkeyVerificationRequired: false
};

export function storeAuth(overrides: Partial<typeof authState> = {}) {
  sessionStorage.setItem('rta.auth', JSON.stringify({ ...authState, ...overrides }));
}

export function renderApp(path = '/workflows') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

export function captchaChallengeResponse() {
  return jsonResponse({
    required: true,
    provider: 'challenge',
    token: 'signed-challenge',
    prompt: 'What is 2 + 3?',
    expires_in_seconds: 300
  });
}

export function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function renderWithRouter(element: ReactElement, path = '/') {
  return render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
}
