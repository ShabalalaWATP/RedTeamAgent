import { describe, expect, it } from 'vitest';
import { analyseVisits, shortUserAgent } from '../src/features/settings/VisitInsightsPanel';
import type { SiteUser, SiteVisit } from '../src/shared/types';

let counter = 0;
function visit(overrides: Partial<SiteVisit>): SiteVisit {
  counter += 1;
  return {
    id: `visit-${counter}`,
    user_id: null,
    ip_address: '10.0.0.1',
    method: 'GET',
    path: '/workflows',
    user_agent: 'agent',
    created_at: '2026-06-28T00:00:00Z',
    ...overrides
  };
}

const user = (id: string) => ({ id }) as unknown as SiteUser;

describe('analyseVisits', () => {
  it('flags anonymous privileged access, repeated IPs, writes and unknown users', () => {
    const visits: SiteVisit[] = [
      visit({ user_id: null, path: '/settings' }),
      visit({ user_id: 'u1' }),
      visit({ user_id: 'u1', method: 'POST' }),
      visit({ user_id: 'u1' }),
      visit({ user_id: 'ghost' }),
      visit({ ip_address: '10.0.0.2', user_id: 'u1' })
    ];

    const insights = analyseVisits(visits, [user('u1')]);
    const text = insights.signals.join(' ');

    expect(insights.tone).toBe('warn');
    expect(text).toMatch(/privileged pages/);
    expect(text).toMatch(/recent visit/);
    expect(text).toMatch(/non-GET/);
    expect(text).toMatch(/outside this view/);
  });

  it('falls back to the most common path when there are no anomalies', () => {
    const visits: SiteVisit[] = [
      visit({ ip_address: '10.0.0.1', user_id: 'u1', path: '/workflows' }),
      visit({ ip_address: '10.0.0.2', user_id: 'u1', path: '/workflows' }),
      visit({ ip_address: '10.0.0.3', user_id: 'u1', path: '/projects' })
    ];

    const insights = analyseVisits(visits, [user('u1')]);

    expect(insights.tone).toBe('ok');
    expect(insights.signals).toEqual(['Most common path: /workflows.']);
  });

  it('shortens long user agents and labels empty ones', () => {
    expect(shortUserAgent('')).toBe('unknown user agent');
    expect(shortUserAgent('a'.repeat(100))).toHaveLength(72);
  });
});
