import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunProgressPanel, stageLabel, type RunEvent } from '../src/features/reports/RunProgressPanel';

const baseEvents: RunEvent[] = [
  event(1, 'intake', 'Run queued.', '2026-06-29T01:01:38.000Z'),
  event(2, 'ingestion', 'Evidence ready.', '2026-06-29T01:01:39.000Z'),
  event(3, 'framing', 'Frame ready.', '2026-06-29T01:01:40.000Z'),
  event(4, 'agent_planning', 'Agents selected.', '2026-06-29T01:01:41.000Z'),
  event(5, 'specialist_review', 'Evidence sent to LLM agents.', '2026-06-29T01:01:42.000Z'),
  event(6, 'specialist_review', 'Evidence and Context Agent returned 6 usable LLM claim(s).', '2026-06-29T01:02:01.000Z')
];

describe('RunProgressPanel', () => {
  it('shows the current stage, percentage, elapsed time and latest agent update', () => {
    render(<RunProgressPanel events={baseEvents} runState="specialist_review" />);

    expect(screen.getByText('Stage 5 of 8: LLM specialist review')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Review progress' })).toHaveAttribute('value', '50');
    expect(screen.getByText('23s elapsed')).toBeInTheDocument();
    expect(screen.getByText('1 specialist agent update(s) received.')).toBeInTheDocument();
    expect(screen.getByText(/Evidence and Context Agent returned 6 usable/)).toBeInTheDocument();
  });

  it('marks all stages complete when the run is completed', () => {
    render(<RunProgressPanel events={[...baseEvents, event(7, 'completed', 'Done.', '2026-06-29T01:04:11.000Z')]} runState="completed" />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Review progress' })).toHaveAttribute('value', '100');
    expect(screen.getByText('2m 33s elapsed')).toBeInTheDocument();
  });

  it('falls back to raw labels for unknown states', () => {
    expect(stageLabel('custom_state')).toBe('custom_state');
  });
});

function event(sequence: number, state: string, message: string, createdAt: string): RunEvent {
  return {
    id: `event-${sequence}`,
    state,
    message,
    sequence,
    created_at: createdAt
  };
}
