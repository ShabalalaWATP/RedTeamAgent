import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '../src/app/ThemeToggle';

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe('theme toggle', () => {
  it('defaults to dark, switches to light, and back again', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle className="topbar-toggle" />);

    await user.click(screen.getByRole('button', { name: /switch to light mode/i }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('rta.theme')).toBe('light');

    await user.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('rta.theme')).toBe('dark');
  });

  it('reflects an existing light preference on mount', () => {
    document.documentElement.dataset.theme = 'light';
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });
});
