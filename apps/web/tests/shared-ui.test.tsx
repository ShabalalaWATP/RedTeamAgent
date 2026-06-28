import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BackButton, Button } from '../src/shared/ui';

describe('Button as a link', () => {
  it('links to its destination when enabled', () => {
    render(
      <MemoryRouter>
        <Button asLink to="/runs/run-1">Open report</Button>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Open report' });
    expect(link).toHaveAttribute('href', '/runs/run-1');
    expect(link.className).not.toContain('disabled');
    expect(link).not.toHaveAttribute('aria-disabled');
  });

  it('neutralises the destination and marks itself disabled when disabled', () => {
    render(
      <MemoryRouter>
        <Button asLink to="/runs/run-1" disabled>Open report</Button>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Open report' });
    expect(link.getAttribute('href')).not.toBe('/runs/run-1');
    expect(link.className).toContain('disabled');
    expect(link).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('BackButton', () => {
  it('uses the fallback route for direct page loads', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/current', key: 'default' }]}>
        <Routes>
          <Route path="/current" element={<BackButton fallback="/fallback" />} />
          <Route path="/fallback" element={<h1>Fallback</h1>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByRole('heading', { name: 'Fallback' })).toBeInTheDocument();
  });

  it('returns to the previous route when router history exists', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/previous', key: 'previous' },
          { pathname: '/current', key: 'current' }
        ]}
        initialIndex={1}
      >
        <Routes>
          <Route path="/previous" element={<h1>Previous</h1>} />
          <Route path="/current" element={<BackButton fallback="/fallback" />} />
          <Route path="/fallback" element={<h1>Fallback</h1>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByRole('heading', { name: 'Previous' })).toBeInTheDocument();
  });
});
