import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('new review context packs', () => {
  it('shows saved pack provenance and creates a pack for the selected agent', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/context-packs?')) {
        return jsonResponse([
          {
            id: 'pack-existing',
            workspace_id: authState.workspaceId,
            name: 'Existing policy pack',
            agent_key: 'policy_governance',
            markdown: '# Existing policy\nCheck decision rights.',
            version: 3
          }
        ]);
      }
      if (url.endsWith('/context-packs') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body).toMatchObject({
          workspace_id: authState.workspaceId,
          agent_key: 'operations_delivery',
          name: 'Delivery pack'
        });
        return jsonResponse({
          id: 'pack-created',
          workspace_id: authState.workspaceId,
          name: body.name,
          agent_key: body.agent_key,
          markdown: body.markdown,
          version: 1
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/projects/project-1/reviews/new');
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    expect(await screen.findByText('Existing policy pack')).toBeInTheDocument();
    expect(screen.getByText('policy_governance')).toBeInTheDocument();
    expect(screen.getByText('Version 3')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/context pack name/i));
    await user.type(screen.getByLabelText(/context pack name/i), 'Delivery pack');
    await user.selectOptions(screen.getByLabelText(/^agent$/i), 'operations_delivery');
    await user.clear(screen.getByLabelText(/^markdown$/i));
    await user.type(screen.getByLabelText(/^markdown$/i), '# Delivery\nConfirm owners and rollback.');
    await user.click(screen.getByRole('button', { name: /add context pack/i }));

    expect(await screen.findByText('Delivery pack')).toBeInTheDocument();
    expect(screen.getByText('operations_delivery')).toBeInTheDocument();
    expect(screen.getByText(/Saved Delivery pack for operations_delivery as version 1/i)).toBeInTheDocument();
  });

  it('surfaces context-pack load errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/context-packs?')) return jsonResponse({ message: 'context denied' }, 403);
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/projects/project-1/reviews/new');
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('context denied');
  });

  it('prevents context form submission and shows save errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/context-packs?')) return jsonResponse([]);
      if (url.endsWith('/context-packs') && init?.method === 'POST') {
        return jsonResponse({ message: 'invalid context' }, 422);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/projects/project-1/reviews/new');
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    fireEvent.submit(screen.getByRole('heading', { name: 'Context packs' }).closest('form') as HTMLFormElement);
    expect(screen.getByRole('heading', { name: 'New review' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add context pack/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid context');
  });

  it('renders empty Markdown context previews', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/context-packs?')) {
        return jsonResponse([
          {
            id: 'pack-empty',
            workspace_id: authState.workspaceId,
            name: 'Empty pack',
            agent_key: 'policy_governance',
            markdown: '',
            version: 1
          }
        ]);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/projects/project-1/reviews/new');
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    expect(await screen.findByText('Markdown context')).toBeInTheDocument();
  });
});
